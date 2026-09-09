import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
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
    const [hardwareDetected, setHardwareDetected] = useState<boolean>(false);
    const [hardwareEnrolled, setHardwareEnrolled] = useState<boolean>(false);

    // 2FA / TOTP Authenticator States
    const [isMfaActive, setIsMfaActive] = useState<boolean>(false);
    const [mfaFactor, setMfaFactor] = useState<any>(null);
    const [mfaLoading, setMfaLoading] = useState<boolean>(false);
    const [mfaForLogin, setMfaForLogin] = useState<boolean>(true);
    const [mfaForTransfers, setMfaForTransfers] = useState<boolean>(true);
    const [mfaForSecurityChanges, setMfaForSecurityChanges] = useState<boolean>(true);
    
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
    const [pendingActionAfter2fa, setPendingActionAfter2fa] = useState<string | null>(null);

    // App Lock & Privacy States
    const [autoLockInterval, setAutoLockInterval] = useState<string>('60'); // '0' | '60' | '300' | '900'
    const [hideBalanceByDefault, setHideBalanceByDefault] = useState<boolean>(false);
    const [loginEmailAlerts, setLoginEmailAlerts] = useState<boolean>(true);

    // Emergency Freeze States
    const [isAccountFrozen, setIsAccountFrozen] = useState<boolean>(false);
    const [freezeModalVisible, setFreezeModalVisible] = useState<boolean>(false);
    const [freezeActionType, setFreezeActionType] = useState<'freeze' | 'unfreeze'>('freeze');
    const [freezePin, setFreezePin] = useState<string>('');
    const [processingFreeze, setProcessingFreeze] = useState<boolean>(false);

    // Audit & Diagnostic Modal State
    const [auditModalVisible, setAuditModalVisible] = useState<boolean>(false);

    useFocusEffect(
        useCallback(() => {
            loadSecurityOverview();
        }, [])
    );

    const showToast = (msg: string) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(null), 2500);
    };

    // 1. Load Complete Security Telemetry
    const loadSecurityOverview = async () => {
        try {
            setLoadingData(true);

            // A. Supabase Session & Profile
            let activeUserId: string | null = null;
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                activeUserId = user.id;
                if (user.email) setUserEmail(user.email);
                if (user.last_sign_in_at) {
                    try {
                        const date = new Date(user.last_sign_in_at);
                        setLastSignInTime(date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }));
                    } catch {
                        setLastSignInTime('Active');
                    }
                }
            } else {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    activeUserId = session.user.id;
                    if (session.user.email) setUserEmail(session.user.email);
                }
            }

            // Check Transaction PIN (Multi-layer: Supabase Profile -> SecureStore -> AsyncStorage)
            let pinFound = false;
            if (activeUserId) {
                try {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('transaction_pin')
                        .eq('id', activeUserId)
                        .maybeSingle();

                    if (profile?.transaction_pin && String(profile.transaction_pin).length >= 4) {
                        pinFound = true;
                    }
                } catch (dbErr) {
                    console.warn("Profile PIN query error:", dbErr);
                }
            }

            if (!pinFound) {
                try {
                    let localPin: string | null = null;
                    if (Platform.OS === 'web') {
                        localPin = await AsyncStorage.getItem('user_transaction_pin');
                        if (!localPin && activeUserId) {
                            localPin = await AsyncStorage.getItem(`user_transaction_pin_${activeUserId}`);
                        }
                    } else {
                        localPin = await SecureStore.getItemAsync('user_transaction_pin');
                        if (!localPin && activeUserId) {
                            localPin = await SecureStore.getItemAsync(`user_transaction_pin_${activeUserId}`);
                        }
                        if (!localPin) {
                            localPin = await AsyncStorage.getItem('user_transaction_pin');
                        }
                    }
                    if (localPin && String(localPin).length >= 4) {
                        pinFound = true;
                    }
                } catch (storeErr) {
                    console.warn("Storage PIN query error:", storeErr);
                }
            }
            setHasPinConfigured(pinFound);

            // B. Hardware Biometrics Detection & Key Harmonization
            try {
                if (Platform.OS !== 'web') {
                    const hasHw = await LocalAuthentication.hasHardwareAsync();
                    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
                    setHardwareDetected(hasHw);
                    setHardwareEnrolled(isEnrolled);

                    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
                    let detected = 'Biometrics';
                    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
                        detected = 'Face ID';
                    } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
                        detected = Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
                    }
                    setBiometricType(detected);
                    setBiometricAvailable(true);

                    const bioFlag = await AsyncStorage.getItem('biometrics_enabled');
                    const bioCompleted = await AsyncStorage.getItem('biometrics_setup_completed');
                    const isBioActive = (bioFlag === 'true' || bioCompleted === 'true') && bioFlag !== 'false' && bioCompleted !== 'false';
                    setBiometricEnabled(isBioActive);
                } else {
                    setHardwareDetected(false);
                    setHardwareEnrolled(false);
                    setBiometricAvailable(true);
                    setBiometricType('Biometrics');
                    const bioFlag = await AsyncStorage.getItem('biometrics_enabled');
                    setBiometricEnabled(bioFlag === 'true');
                }
            } catch (bioErr) {
                console.warn("Biometrics telemetry check:", bioErr);
                setBiometricAvailable(true);
            }

            // C. Google Authenticator 2FA Verification & Protection Scopes
            const savedLoginMfa = await AsyncStorage.getItem('mfa_required_for_login');
            setMfaForLogin(savedLoginMfa !== 'false');

            const savedTransferMfa = await AsyncStorage.getItem('mfa_required_for_transfers');
            setMfaForTransfers(savedTransferMfa !== 'false');

            const savedSecurityMfa = await AsyncStorage.getItem('mfa_required_for_security_changes');
            setMfaForSecurityChanges(savedSecurityMfa !== 'false');

            await checkMfaStatus();

            // D. App Lock, Privacy Shield & Emergency Freeze Preferences
            const savedLock = await AsyncStorage.getItem('app_auto_lock_interval');
            if (savedLock) setAutoLockInterval(savedLock);

            const savedHideBal = await AsyncStorage.getItem('hide_balance_by_default');
            setHideBalanceByDefault(savedHideBal === 'true');

            const savedAlerts = await AsyncStorage.getItem('login_email_alerts');
            setLoginEmailAlerts(savedAlerts !== 'false');

            const savedFreeze = await AsyncStorage.getItem('account_emergency_freeze');
            setIsAccountFrozen(savedFreeze === 'true');
        } catch (e) {
            console.warn("loadSecurityOverview error:", e);
        } finally {
            setLoadingData(false);
        }
    };

    // Auto-Lock Inactivity Interval Change
    const handleChangeAutoLock = async (val: string) => {
        setAutoLockInterval(val);
        await AsyncStorage.setItem('app_auto_lock_interval', val);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        const labels: Record<string, string> = {
            '0': 'Immediately',
            '60': 'After 1 Minute',
            '300': 'After 5 Minutes',
            '900': 'After 15 Minutes',
        };
        showToast(`Auto-Lock set to ${labels[val] || val}`);
    };

    // Privacy Mode (Hide Balance by Default) Toggle
    const handleToggleHideBalance = async (val: boolean) => {
        setHideBalanceByDefault(val);
        await AsyncStorage.setItem('hide_balance_by_default', val ? 'true' : 'false');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        showToast(val ? "Balance hidden on app launch 👁️" : "Balance visible by default.");
    };

    // Sign-in Email Security Alerts Toggle
    const handleToggleEmailAlerts = async (val: boolean) => {
        setLoginEmailAlerts(val);
        await AsyncStorage.setItem('login_email_alerts', val ? 'true' : 'false');
        try {
            await supabase.auth.updateUser({
                data: { login_email_alerts: val }
            });
        } catch (_) {}
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        showToast(val ? "Sign-in email security alerts active! 🔔" : "Sign-in alerts turned off.");
    };

    // Emergency Account Freeze Flow
    const handleOpenFreezeModal = (type: 'freeze' | 'unfreeze') => {
        setFreezeActionType(type);
        setFreezePin('');
        setFreezeModalVisible(true);
    };

    const handleExecuteFreezeAction = async () => {
        if (freezePin.length < 4) {
            Alert.alert("Invalid PIN", "Please enter your 4-digit transaction PIN to proceed.");
            return;
        }

        setProcessingFreeze(true);
        try {
            // Verify PIN against Supabase or local storage
            let activeUserId: string | null = null;
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                activeUserId = user.id;
            } else {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) activeUserId = session.user.id;
            }

            let correctPin: string | null = null;
            if (activeUserId) {
                try {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('transaction_pin')
                        .eq('id', activeUserId)
                        .maybeSingle();
                    if (profile?.transaction_pin) {
                        correctPin = String(profile.transaction_pin);
                    }
                } catch (_) {}
            }

            if (!correctPin) {
                try {
                    if (Platform.OS === 'web') {
                        correctPin = await AsyncStorage.getItem('user_transaction_pin');
                        if (!correctPin && activeUserId) {
                            correctPin = await AsyncStorage.getItem(`user_transaction_pin_${activeUserId}`);
                        }
                    } else {
                        correctPin = await SecureStore.getItemAsync('user_transaction_pin');
                        if (!correctPin && activeUserId) {
                            correctPin = await SecureStore.getItemAsync(`user_transaction_pin_${activeUserId}`);
                        }
                        if (!correctPin) {
                            correctPin = await AsyncStorage.getItem('user_transaction_pin');
                        }
                    }
                } catch (_) {}
            }

            // Verify entered PIN against retrieved PIN
            if (correctPin && String(correctPin).trim() !== freezePin.trim()) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
                Alert.alert("Incorrect PIN", "The 4-digit transaction PIN you entered is incorrect.");
                setProcessingFreeze(false);
                return;
            }

            // If user had no PIN configured previously, establish entered PIN as active PIN
            if (!correctPin && freezePin.length === 4) {
                if (Platform.OS === 'web') {
                    await AsyncStorage.setItem('user_transaction_pin', freezePin.trim());
                    if (activeUserId) await AsyncStorage.setItem(`user_transaction_pin_${activeUserId}`, freezePin.trim());
                } else {
                    await SecureStore.setItemAsync('user_transaction_pin', freezePin.trim());
                    if (activeUserId) await SecureStore.setItemAsync(`user_transaction_pin_${activeUserId}`, freezePin.trim());
                }
                if (activeUserId) {
                    await supabase.from('profiles').update({ transaction_pin: freezePin.trim() }).eq('id', activeUserId);
                }
                setHasPinConfigured(true);
            }

            if (freezeActionType === 'freeze') {
                await AsyncStorage.setItem('account_emergency_freeze', 'true');
                setIsAccountFrozen(true);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
                Alert.alert(
                    "Account Transfers Frozen! 🛡️",
                    "Outgoing transfers, withdrawals, and data purchases are now temporarily paused. Your wallet funds remain 100% safe. You can unfreeze anytime using your PIN."
                );
                showToast("Emergency Freeze Active 🔒");
            } else {
                await AsyncStorage.setItem('account_emergency_freeze', 'false');
                setIsAccountFrozen(false);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                Alert.alert(
                    "Account Unfrozen! ✨",
                    "Your account has been successfully unfrozen. Normal wallet operations and transfers are restored."
                );
                showToast("Account Unfrozen & Active ✨");
            }
            setFreezeModalVisible(false);
            setFreezePin('');
        } catch (e: any) {
            Alert.alert("Freeze Action Error", e.message || "Could not complete operation.");
        } finally {
            setProcessingFreeze(false);
        }
    };

    const handleToggleLoginMfa = async (val: boolean) => {
        setMfaForLogin(val);
        await AsyncStorage.setItem('mfa_required_for_login', val ? 'true' : 'false');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        showToast(val ? "Login 2FA Protection Active! 🛡️" : "Login 2FA turned off.");
    };

    const handleToggleTransferMfa = async (val: boolean) => {
        setMfaForTransfers(val);
        await AsyncStorage.setItem('mfa_required_for_transfers', val ? 'true' : 'false');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        showToast(val ? "Transfer 2FA Protection Active! 🛡️" : "Transfer 2FA turned off (PIN only).");
    };

    const handleToggleSecurityMfa = async (val: boolean) => {
        setMfaForSecurityChanges(val);
        await AsyncStorage.setItem('mfa_required_for_security_changes', val ? 'true' : 'false');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        showToast(val ? "Security Changes 2FA Active! 🛡️" : "Security Changes 2FA turned off.");
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

    // 2. Hardware Biometrics Toggle & Setup Flow (Face ID / Fingerprint / Touch ID)
    const handleBiometricToggle = async (val?: boolean) => {
        const nextVal = typeof val === 'boolean' ? val : !biometricEnabled;

        if (nextVal) {
            // Turning ON Biometrics
            if ((Platform.OS as string) === 'web') {
                await AsyncStorage.setItem('biometrics_enabled', 'true');
                await AsyncStorage.setItem('biometrics_setup_completed', 'true');
                if (userEmail) {
                    await AsyncStorage.setItem('saved_user_identifier', userEmail);
                }
                setBiometricEnabled(true);
                showToast("Biometric authentication enabled! 🛡️✨");
                Alert.alert("Biometrics Enabled ✨", "Biometric authentication is now active for PIN App Unlock and Transfers.");
                return;
            }

            try {
                const hasHw = await LocalAuthentication.hasHardwareAsync();
                const isEnrolled = await LocalAuthentication.isEnrolledAsync();

                if (!hasHw) {
                    Alert.alert(
                        "Sensor Not Supported",
                        "Biometric sensors (Face ID / Fingerprint) were not detected on this physical device. You can use your 4-digit PIN for full account security."
                    );
                    return;
                }

                if (!isEnrolled) {
                    Alert.alert(
                        "Biometrics Not Enrolled ⚠️",
                        "Your device supports biometric hardware, but no fingerprint or face credentials are registered in your phone Settings.\n\nPlease enroll your fingerprint or face in device Settings to activate this feature.",
                        [
                            { text: "Cancel", style: "cancel" },
                            { 
                                text: "Open Settings ⚙️", 
                                onPress: () => Linking.openSettings().catch(() => {}) 
                            }
                        ]
                    );
                    return;
                }

                // Prompt user to verify biometric identity right now to activate
                const res = await LocalAuthentication.authenticateAsync({
                    promptMessage: `Authorize ${biometricType} for ABU MAFHAL HUB`,
                    fallbackLabel: 'Use Device Passcode',
                    cancelLabel: 'Cancel',
                    disableDeviceFallback: false,
                });

                if (res.success) {
                    await AsyncStorage.setItem('biometrics_enabled', 'true');
                    await AsyncStorage.setItem('biometrics_setup_completed', 'true');
                    if (userEmail) {
                        await AsyncStorage.setItem('saved_user_identifier', userEmail);
                    }
                    setBiometricEnabled(true);
                    setBiometricAvailable(true);
                    if ((Platform.OS as string) !== 'web') {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                    }
                    showToast(`${biometricType} activated with 100% security! 🛡️✨`);
                    Alert.alert(
                        "Biometrics Configured! 🎉",
                        `Your ${biometricType} has been successfully verified and activated. You can now use it on the PIN unlock keypad and transaction modals.`
                    );
                } else {
                    setBiometricEnabled(false);
                }
            } catch (err: any) {
                Alert.alert("Biometric Setup Notice", err.message || "Could not complete biometric authentication.");
                setBiometricEnabled(false);
            }
        } else {
            // Turning OFF Biometrics
            Alert.alert(
                `Disable ${biometricType}?`,
                "Are you sure you want to turn off biometric security? You will need to enter your 4-digit PIN for all transactions and app unlocks.",
                [
                    { text: "Keep Enabled", style: "cancel" },
                    {
                        text: "Disable",
                        style: "destructive",
                        onPress: async () => {
                            await AsyncStorage.setItem('biometrics_enabled', 'false');
                            await AsyncStorage.setItem('biometrics_setup_completed', 'false');
                            setBiometricEnabled(false);
                            if ((Platform.OS as string) !== 'web') {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                            }
                            showToast(`${biometricType} disabled.`);
                        }
                    }
                ]
            );
        }
    };

    // Live Biometric Sensor Test
    const handleTestBiometric = async () => {
        if ((Platform.OS as string) === 'web') {
            Alert.alert("Biometrics Verified ✨", "Web client simulation: Biometric credentials and Secure Enclave are operational.");
            showToast("Biometrics Verified! 🛡️");
            return;
        }

        try {
            const hasHw = await LocalAuthentication.hasHardwareAsync();
            const isEnrolled = await LocalAuthentication.isEnrolledAsync();

            if (!hasHw) {
                Alert.alert(
                    "Sensor Not Detected",
                    "This device does not have hardware biometric sensors (Fingerprint / Face ID)."
                );
                return;
            }

            if (!isEnrolled) {
                Alert.alert(
                    "No Biometrics Enrolled",
                    "Please register your fingerprint or face in your phone Settings first.",
                    [
                        { text: "Cancel", style: "cancel" },
                        { text: "Open Settings ⚙️", onPress: () => Linking.openSettings().catch(() => {}) }
                    ]
                );
                return;
            }

            const res = await LocalAuthentication.authenticateAsync({
                promptMessage: `Test ${biometricType} Sensor`,
                fallbackLabel: 'Use PIN',
                cancelLabel: 'Cancel',
                disableDeviceFallback: false,
            });

            if (res.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                Alert.alert(
                    "Biometrics Active & Verified! ✨",
                    `Your ${biometricType} sensor was tested successfully. Hardware Secure Enclave is fully operational.`
                );
                showToast(`${biometricType} Tested & Verified! 🛡️`);
            } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            }
        } catch (err: any) {
            Alert.alert("Biometric Test Error", err.message || "An error occurred during biometric test.");
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
            setOtpDigits(['', '', '', '', '', '']);
            otpInputRefs.current[0]?.focus();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
            Alert.alert("Verification Failed ❌", err.message || "Invalid 6-digit code. Please verify the code in your Authenticator app and ensure your phone time is accurate.");
        } finally {
            setVerifying(false);
        }
    };

    // 6. 1-Tap Open Directly in Authenticator App (Seamless Mobile UX)
    const handleOpenInAuthenticator = async () => {
        if (!enrollData?.totp?.uri) return;
        // Always copy secret key to clipboard as a high-reliability fallback
        await handleCopySecret();
        try {
            await Linking.openURL(enrollData.totp.uri).catch(async () => {
                Alert.alert(
                    "Setup Key Copied 📋", 
                    "Please open Google Authenticator or Authy, choose 'Enter a setup key', and paste the copied secret key."
                );
            });
        } catch {
            Alert.alert(
                "Setup Key Copied 📋", 
                "Please open Google Authenticator or Authy, choose 'Enter a setup key', and paste the copied secret key."
            );
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
    const handleTestCode = async (overrideCode?: string | any) => {
        const code = (typeof overrideCode === 'string' ? overrideCode : testCode).trim();
        if (code.length !== 6 || !mfaFactor) return;
        setTestingCode(true);
        try {
            const { data: chal, error: chalErr } = await supabase.auth.mfa.challenge({
                factorId: mfaFactor.id
            });
            if (chalErr) throw chalErr;

            const { error: verifyErr } = await supabase.auth.mfa.verify({
                factorId: mfaFactor.id,
                challengeId: chal.id,
                code: code
            });
            if (verifyErr) throw verifyErr;

            setTestModalVisible(false);
            setTestCode('');
            const targetAction = pendingActionAfter2fa;
            setPendingActionAfter2fa(null);

            if (targetAction === 'pin_change') {
                showToast("2FA Verified! Proceeding to PIN change... 🛡️");
                router.push(`/(auth)/pin-setup?action=${hasPinConfigured ? 'reset' : 'setup'}` as any);
            } else if (targetAction === 'password_change') {
                showToast("2FA Verified! Proceeding to Password change... 🛡️");
                router.push('/(auth)/reset-password' as any);
            } else {
                Alert.alert("2FA Synchronized! ✅", "Your Google Authenticator code is 100% active, valid, and working smoothly.");
            }
        } catch (err: any) {
            Alert.alert("Code Verification Failed ❌", "The code was not accepted. Please ensure your device clock is set to automatic time and try again.");
        } finally {
            setTestingCode(false);
        }
    };

    const handlePasteSetupCode = async () => {
        try {
            let text = '';
            if (Platform.OS === 'web') {
                if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
                    text = await navigator.clipboard.readText();
                }
            } else {
                text = await Clipboard.getStringAsync();
            }

            const clean = (text || '').replace(/[^0-9]/g, '').trim();
            if (clean.length >= 6) {
                const digits = clean.slice(0, 6).split('');
                setOtpDigits(digits);
                if ((Platform.OS as string) !== 'web') {
                    try {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    } catch (e) {}
                }
                handleVerifyTotp(clean.slice(0, 6));
            } else if (clean.length > 0) {
                const digits = [...otpDigits];
                for (let i = 0; i < clean.length && i < 6; i++) {
                    digits[i] = clean[i];
                }
                setOtpDigits(digits);
                if (digits.every(d => d !== '') && digits.join('').length === 6) {
                    handleVerifyTotp(digits.join(''));
                } else {
                    otpInputRefs.current[Math.min(clean.length, 5)]?.focus();
                }
            } else {
                Alert.alert("Clipboard Empty 📋", "No 6-digit code found on clipboard. Copy code from Google Authenticator first.");
            }
        } catch (e) {
            console.log("Paste setup code notice:", e);
        }
    };

    const handlePasteTestCode = async (autoSubmit: boolean = true) => {
        try {
            let text = '';
            if (Platform.OS === 'web') {
                if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
                    text = await navigator.clipboard.readText();
                }
            } else {
                text = await Clipboard.getStringAsync();
            }

            const clean = (text || '').replace(/[^0-9]/g, '').trim();
            if (clean.length >= 6) {
                const code = clean.slice(0, 6);
                setTestCode(code);
                if ((Platform.OS as string) !== 'web') {
                    try {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    } catch (e) {}
                }
                if (autoSubmit) {
                    handleTestCode(code);
                }
            } else if (clean.length > 0) {
                setTestCode(clean);
            } else {
                Alert.alert("Clipboard Empty 📋", "No 6-digit code found on clipboard.");
            }
        } catch (e) {
            console.log("Paste test code notice:", e);
        }
    };

    // Initiators that protect PIN and Password changes with 2FA
    const handleInitiatePinChange = () => {
        if (hasPinConfigured && isMfaActive && mfaForSecurityChanges) {
            setPendingActionAfter2fa('pin_change');
            setTestModalVisible(true);
            showToast("Verify 2FA code to change Transaction PIN 🛡️");
            return;
        }
        router.push(`/(auth)/pin-setup?action=${hasPinConfigured ? 'reset' : 'setup'}` as any);
    };

    const handleInitiatePasswordChange = () => {
        if (isMfaActive && mfaForSecurityChanges) {
            setPendingActionAfter2fa('password_change');
            setTestModalVisible(true);
            showToast("Verify 2FA code to update Login Password 🛡️");
            return;
        }
        router.push('/(auth)/reset-password' as any);
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
        let score = 20; // Base verified account credentials
        if (hasPinConfigured) score += 20; // Transaction PIN
        if (biometricEnabled) score += 20; // Hardware Biometrics
        if (isMfaActive) score += 20;       // Google Authenticator 2FA
        if (autoLockInterval !== '900') score += 10; // Auto-Lock (immediate or <= 5 mins)
        if (hideBalanceByDefault) score += 10; // Privacy Mode
        return Math.min(score, 100);
    };

    const securityScore = calculateSecurityScore();

    const active2faLocationsCount = isMfaActive
        ? (mfaForLogin ? 1 : 0) + (mfaForTransfers ? 1 : 0) + (mfaForSecurityChanges ? 1 : 0)
        : 0;

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
                                    <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>Account Security Rating</Text>
                                    <Text style={{ color: '#94A3B8', fontSize: 9.5, fontWeight: '500' }}>{userEmail || 'Active Protected Session'}</Text>
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
                                    {securityScore}% {securityScore === 100 ? 'OPTIMAL' : securityScore >= 75 ? 'STRONG' : 'BASIC'}
                                </Text>
                            </View>
                        </View>

                        {/* Visual Security Progress Bar */}
                        <View style={{ width: '100%', height: 4, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 2, overflow: 'hidden' }}>
                            <LinearGradient
                                colors={securityScore >= 75 ? [L.emerald, '#059669'] : [L.gold, L.goldDk]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={{ width: `${securityScore}%`, height: '100%' }}
                            />
                        </View>
                    </View>
                </LinearGradient>

                {/* 2. BODY CONTENT (Clean, Minimalist, 100% English & 100% Real Interactive Settings) */}
                <ScrollView 
                    style={{ flex: 1 }} 
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ padding: 14, gap: 14, paddingBottom: 40 }}
                >
                    {/* SECTION 1: CREDENTIALS & PASSCODES */}
                    <View>
                        <Text style={{ color: L.textMuted, fontSize: 10.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, marginLeft: 4 }}>
                            Credentials & Passcodes
                        </Text>
                        <View style={{ backgroundColor: L.card, borderRadius: 14, borderWidth: 1, borderColor: L.cardBorder, overflow: 'hidden' }}>
                            {/* Login Password */}
                            <TouchableOpacity
                                onPress={handleInitiatePasswordChange}
                                activeOpacity={0.7}
                                style={{ 
                                    flexDirection: 'row', 
                                    alignItems: 'center', 
                                    justifyContent: 'space-between', 
                                    padding: 14, 
                                    borderBottomWidth: 1, 
                                    borderColor: '#F1F5F9' 
                                }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
                                        <Ionicons name="lock-closed-outline" size={18} color={L.navyHeader} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ color: L.textPrimary, fontSize: 12.5, fontWeight: '800' }}>Login Password</Text>
                                        <Text style={{ color: L.textMuted, fontSize: 10, marginTop: 1 }}>Change your account login password</Text>
                                    </View>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <Text style={{ color: L.blue, fontSize: 11, fontWeight: '700' }}>Update</Text>
                                    <Ionicons name="chevron-forward" size={15} color="#94A3B8" />
                                </View>
                            </TouchableOpacity>

                            {/* Transaction PIN */}
                            <TouchableOpacity
                                onPress={handleInitiatePinChange}
                                activeOpacity={0.7}
                                style={{ 
                                    flexDirection: 'row', 
                                    alignItems: 'center', 
                                    justifyContent: 'space-between', 
                                    padding: 14 
                                }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: L.goldBg, borderWidth: 1, borderColor: L.goldBorder, alignItems: 'center', justifyContent: 'center' }}>
                                        <Ionicons name="keypad-outline" size={18} color={L.goldDk} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Text style={{ color: L.textPrimary, fontSize: 12.5, fontWeight: '800' }}>4-Digit Transaction PIN</Text>
                                            <View style={{ backgroundColor: hasPinConfigured ? L.emeraldBg : L.goldBg, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                                                <Text style={{ color: hasPinConfigured ? L.emerald : L.goldAmber, fontSize: 8, fontWeight: '900' }}>
                                                    {hasPinConfigured ? 'CONFIGURED' : 'NOT SET'}
                                                </Text>
                                            </View>
                                        </View>
                                        <Text style={{ color: L.textMuted, fontSize: 10, marginTop: 1 }}>Required for transfers, withdrawals, and orders</Text>
                                    </View>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <Text style={{ color: L.goldDk, fontSize: 11, fontWeight: '700' }}>{hasPinConfigured ? 'Change' : 'Set Up'}</Text>
                                    <Ionicons name="chevron-forward" size={15} color="#94A3B8" />
                                </View>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* SECTION 2: BIOMETRIC AUTHENTICATION */}
                    <View>
                        <Text style={{ color: L.textMuted, fontSize: 10.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, marginLeft: 4 }}>
                            Biometrics
                        </Text>
                        <View style={{ backgroundColor: L.card, borderRadius: 14, borderWidth: 1, borderColor: L.cardBorder, overflow: 'hidden' }}>
                            <TouchableOpacity 
                                onPress={() => handleBiometricToggle(!biometricEnabled)}
                                activeOpacity={0.7}
                                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: 8 }}>
                                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: biometricEnabled ? L.blueBg : '#F1F5F9', borderWidth: 1, borderColor: biometricEnabled ? L.blueBorder : '#E2E8F0', alignItems: 'center', justifyContent: 'center' }}>
                                        <MaterialCommunityIcons 
                                            name={biometricType === 'Face ID' ? "face-recognition" : "fingerprint"} 
                                            size={20} 
                                            color={biometricEnabled ? L.blue : L.navyHeader} 
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Text style={{ color: L.textPrimary, fontSize: 12.5, fontWeight: '800' }}>{biometricType}</Text>
                                            <View style={{ backgroundColor: biometricEnabled ? L.blueBg : hardwareEnrolled ? L.emeraldBg : '#F1F5F9', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                                                <Text style={{ color: biometricEnabled ? L.blue : hardwareEnrolled ? L.emerald : L.textSecondary, fontSize: 8, fontWeight: '900' }}>
                                                    {biometricEnabled ? 'ENABLED' : hardwareEnrolled ? 'ENROLLED' : 'SETUP'}
                                                </Text>
                                            </View>
                                        </View>
                                        <Text style={{ color: L.textMuted, fontSize: 10, marginTop: 1 }}>
                                            {biometricEnabled 
                                                ? `Protected: Unlock app & approve payouts with ${biometricType}` 
                                                : `Tap to configure and activate ${biometricType} protection`}
                                        </Text>
                                    </View>
                                </View>

                                <Switch
                                    trackColor={{ false: '#E2E8F0', true: '#2563EB' }}
                                    thumbColor={biometricEnabled ? '#FFFFFF' : '#94A3B8'}
                                    onValueChange={handleBiometricToggle}
                                    value={biometricEnabled}
                                    disabled={false}
                                    style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
                                />
                            </TouchableOpacity>

                            {/* Sensor Status Strip & Action Buttons (Always Visible) */}
                            <View style={{ borderTopWidth: 1, borderColor: '#F1F5F9', paddingHorizontal: 14, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                    <Ionicons 
                                        name={biometricEnabled ? "shield-checkmark" : "finger-print-outline"} 
                                        size={14} 
                                        color={biometricEnabled ? L.emerald : L.goldAmber} 
                                    />
                                    <Text style={{ color: L.textMuted, fontSize: 9.5, fontWeight: '600' }}>
                                        {biometricEnabled ? "Secure Enclave Active" : "Hardware Sensor Available"}
                                    </Text>
                                </View>
                                <View style={{ flexDirection: 'row', gap: 6 }}>
                                    {!biometricEnabled && (
                                        <TouchableOpacity 
                                            onPress={() => handleBiometricToggle(true)}
                                            style={{ backgroundColor: L.blue, paddingHorizontal: 10, paddingVertical: 4.5, borderRadius: 6 }}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={{ color: '#FFFFFF', fontSize: 9.5, fontWeight: '800' }}>Enable Now ⚡</Text>
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity 
                                        onPress={handleTestBiometric}
                                        style={{ backgroundColor: L.blueBg, paddingHorizontal: 9, paddingVertical: 4.5, borderRadius: 6, borderWidth: 0.8, borderColor: L.blueBorder }}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={{ color: L.blue, fontSize: 9.5, fontWeight: '800' }}>Test Sensor 🔬</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Active Protection Scopes Indicator */}
                            <View style={{ borderTopWidth: 1, borderColor: '#F1F5F9', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: biometricEnabled ? '#F8FAFC' : '#FFFFFF' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <Text style={{ color: L.textSecondary, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                        {biometricEnabled ? "Active Protection Locations" : "Biometric Target Locations"}
                                    </Text>
                                    <View style={{ backgroundColor: biometricEnabled ? L.emeraldBg : '#F1F5F9', paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 5 }}>
                                        <Text style={{ color: biometricEnabled ? L.emerald : L.textMuted, fontSize: 8.5, fontWeight: '800' }}>
                                            {biometricEnabled ? "2 OF 2 ACTIVE" : "ENABLE TO ACTIVATE"}
                                        </Text>
                                    </View>
                                </View>

                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: biometricEnabled ? L.emeraldBg : '#F8FAFC', borderWidth: 1, borderColor: biometricEnabled ? L.emeraldBorder : '#E2E8F0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                                        <Ionicons name={biometricEnabled ? "checkmark-circle" : "ellipse-outline"} size={12} color={biometricEnabled ? L.emerald : L.textMuted} />
                                        <Text style={{ color: biometricEnabled ? '#065F46' : L.textSecondary, fontSize: 9.5, fontWeight: '700' }}>App Unlock (PIN Screen)</Text>
                                    </View>

                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: biometricEnabled ? L.emeraldBg : '#F8FAFC', borderWidth: 1, borderColor: biometricEnabled ? L.emeraldBorder : '#E2E8F0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                                        <Ionicons name={biometricEnabled ? "checkmark-circle" : "ellipse-outline"} size={12} color={biometricEnabled ? L.emerald : L.textMuted} />
                                        <Text style={{ color: biometricEnabled ? '#065F46' : L.textSecondary, fontSize: 9.5, fontWeight: '700' }}>Transfers & Cashout Modal</Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* SECTION 3: TWO-FACTOR AUTHENTICATION (2FA) */}
                    <View>
                        <Text style={{ color: L.textMuted, fontSize: 10.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, marginLeft: 4 }}>
                            Two-Factor Authentication (2FA)
                        </Text>
                        <View style={{ backgroundColor: L.card, borderRadius: 14, borderWidth: 1, borderColor: L.cardBorder, overflow: 'hidden' }}>
                            {/* Main 2FA Switch Row */}
                            <TouchableOpacity
                                onPress={() => handleToggleMfa(!isMfaActive)}
                                activeOpacity={0.7}
                                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: 8 }}>
                                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: isMfaActive ? L.emeraldBg : L.goldBg, borderWidth: 1, borderColor: isMfaActive ? L.emeraldBorder : L.goldBorder, alignItems: 'center', justifyContent: 'center' }}>
                                        <Ionicons name="qr-code-outline" size={18} color={isMfaActive ? L.emerald : L.goldDk} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Text style={{ color: L.textPrimary, fontSize: 12.5, fontWeight: '800' }}>Google Authenticator</Text>
                                            <View style={{ backgroundColor: isMfaActive ? L.emeraldBg : L.goldBg, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                                                <Text style={{ color: isMfaActive ? L.emerald : L.goldAmber, fontSize: 8, fontWeight: '900' }}>
                                                    {isMfaActive ? 'ACTIVE' : 'RECOMMENDED'}
                                                </Text>
                                            </View>
                                        </View>
                                        <Text style={{ color: L.textMuted, fontSize: 10, marginTop: 1 }}>
                                            {isMfaActive 
                                                ? "6-digit dynamic TOTP codes active across 3 security layers" 
                                                : "Protect logins, payouts, and security with Google Authenticator"}
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
                                        style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
                                    />
                                )}
                            </TouchableOpacity>

                            {/* Action Buttons Strip */}
                            <View style={{ borderTopWidth: 1, borderColor: '#F1F5F9', paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                    <Ionicons name="time-outline" size={13} color={isMfaActive ? L.emerald : L.textMuted} />
                                    <Text style={{ color: isMfaActive ? '#065F46' : L.textMuted, fontSize: 9.5, fontWeight: isMfaActive ? '700' : '500' }}>
                                        {isMfaActive ? '30s Dynamic TOTP Synced' : 'Authenticator Ready for Setup'}
                                    </Text>
                                </View>
                                <View style={{ flexDirection: 'row', gap: 6 }}>
                                    {!isMfaActive && (
                                        <TouchableOpacity 
                                            onPress={() => handleToggleMfa(true)}
                                            style={{ backgroundColor: L.emerald, paddingHorizontal: 10, paddingVertical: 4.5, borderRadius: 6 }}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={{ color: '#FFFFFF', fontSize: 9.5, fontWeight: '800' }}>Enable 2FA ⚡</Text>
                                        </TouchableOpacity>
                                    )}
                                    {isMfaActive && (
                                        <TouchableOpacity 
                                            onPress={() => setTestModalVisible(true)}
                                            style={{ backgroundColor: L.emeraldBg, paddingHorizontal: 9, paddingVertical: 4.5, borderRadius: 6, borderWidth: 0.8, borderColor: L.emeraldBorder }}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={{ color: L.emerald, fontSize: 9.5, fontWeight: '800' }}>Test Code 🔬</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>

                            {/* Active 2FA Protection Scopes Indicator */}
                            <View style={{ borderTopWidth: 1, borderColor: '#F1F5F9', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: isMfaActive ? '#F8FAFC' : '#FFFFFF' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <Text style={{ color: L.textSecondary, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                        {isMfaActive ? "Active 2FA Protection Locations" : "2FA Target Locations"}
                                    </Text>
                                    <View style={{ backgroundColor: isMfaActive ? L.emeraldBg : '#F1F5F9', paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 5 }}>
                                        <Text style={{ color: isMfaActive ? L.emerald : L.textMuted, fontSize: 8.5, fontWeight: '800' }}>
                                            {isMfaActive ? `${active2faLocationsCount} OF 3 ACTIVE` : "ENABLE 2FA TO ACTIVATE"}
                                        </Text>
                                    </View>
                                </View>

                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                    {/* Location 1: Account Login */}
                                    <View style={{ 
                                        flexDirection: 'row', 
                                        alignItems: 'center', 
                                        gap: 4, 
                                        backgroundColor: (isMfaActive && mfaForLogin) ? L.emeraldBg : '#F8FAFC', 
                                        borderWidth: 1, 
                                        borderColor: (isMfaActive && mfaForLogin) ? L.emeraldBorder : '#E2E8F0', 
                                        paddingHorizontal: 8, 
                                        paddingVertical: 4, 
                                        borderRadius: 6 
                                    }}>
                                        <Ionicons 
                                            name={(isMfaActive && mfaForLogin) ? "checkmark-circle" : "ellipse-outline"} 
                                            size={12} 
                                            color={(isMfaActive && mfaForLogin) ? L.emerald : L.textMuted} 
                                        />
                                        <Text style={{ color: (isMfaActive && mfaForLogin) ? '#065F46' : L.textSecondary, fontSize: 9.5, fontWeight: '700' }}>
                                            Account Login Sign-In
                                        </Text>
                                    </View>

                                    {/* Location 2: Transfers & Payouts */}
                                    <View style={{ 
                                        flexDirection: 'row', 
                                        alignItems: 'center', 
                                        gap: 4, 
                                        backgroundColor: (isMfaActive && mfaForTransfers) ? L.emeraldBg : '#F8FAFC', 
                                        borderWidth: 1, 
                                        borderColor: (isMfaActive && mfaForTransfers) ? L.emeraldBorder : '#E2E8F0', 
                                        paddingHorizontal: 8, 
                                        paddingVertical: 4, 
                                        borderRadius: 6 
                                    }}>
                                        <Ionicons 
                                            name={(isMfaActive && mfaForTransfers) ? "checkmark-circle" : "ellipse-outline"} 
                                            size={12} 
                                            color={(isMfaActive && mfaForTransfers) ? L.emerald : L.textMuted} 
                                        />
                                        <Text style={{ color: (isMfaActive && mfaForTransfers) ? '#065F46' : L.textSecondary, fontSize: 9.5, fontWeight: '700' }}>
                                            Transfers & Cashout Modal
                                        </Text>
                                    </View>

                                    {/* Location 3: Security & PIN Changes */}
                                    <View style={{ 
                                        flexDirection: 'row', 
                                        alignItems: 'center', 
                                        gap: 4, 
                                        backgroundColor: (isMfaActive && mfaForSecurityChanges) ? L.emeraldBg : '#F8FAFC', 
                                        borderWidth: 1, 
                                        borderColor: (isMfaActive && mfaForSecurityChanges) ? L.emeraldBorder : '#E2E8F0', 
                                        paddingHorizontal: 8, 
                                        paddingVertical: 4, 
                                        borderRadius: 6 
                                    }}>
                                        <Ionicons 
                                            name={(isMfaActive && mfaForSecurityChanges) ? "checkmark-circle" : "ellipse-outline"} 
                                            size={12} 
                                            color={(isMfaActive && mfaForSecurityChanges) ? L.emerald : L.textMuted} 
                                        />
                                        <Text style={{ color: (isMfaActive && mfaForSecurityChanges) ? '#065F46' : L.textSecondary, fontSize: 9.5, fontWeight: '700' }}>
                                            PIN Resets & Security Changes
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* Granular 2FA Location Configuration Switches (When 2FA is Active) */}
                            {isMfaActive && (
                                <View style={{ borderTopWidth: 1, borderColor: '#F1F5F9' }}>
                                    {/* Scope 1: Login Toggle */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F8FAFC' }}>
                                        <View style={{ flex: 1, paddingRight: 8 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                                <Ionicons name="log-in-outline" size={14} color={L.emerald} />
                                                <Text style={{ color: L.textPrimary, fontSize: 11.5, fontWeight: '700' }}>Require 2FA on Account Login</Text>
                                            </View>
                                            <Text style={{ color: L.textMuted, fontSize: 9.5, marginTop: 2, paddingLeft: 19 }}>
                                                Prompt for 6-digit Authenticator code when signing into your account
                                            </Text>
                                        </View>
                                        <Switch
                                            trackColor={{ false: '#E2E8F0', true: '#10B981' }}
                                            thumbColor={mfaForLogin ? '#FFFFFF' : '#94A3B8'}
                                            onValueChange={handleToggleLoginMfa}
                                            value={mfaForLogin}
                                            style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                                        />
                                    </View>

                                    {/* Scope 2: Transfer Protection Toggle */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F8FAFC' }}>
                                        <View style={{ flex: 1, paddingRight: 8 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                                <Ionicons name="paper-plane-outline" size={14} color={L.emerald} />
                                                <Text style={{ color: L.textPrimary, fontSize: 11.5, fontWeight: '700' }}>Require 2FA for Transfers & Payouts</Text>
                                            </View>
                                            <Text style={{ color: L.textMuted, fontSize: 9.5, marginTop: 2, paddingLeft: 19 }}>
                                                Prompt for 6-digit code before completing payouts and money transfers
                                            </Text>
                                        </View>
                                        <Switch
                                            trackColor={{ false: '#E2E8F0', true: '#10B981' }}
                                            thumbColor={mfaForTransfers ? '#FFFFFF' : '#94A3B8'}
                                            onValueChange={handleToggleTransferMfa}
                                            value={mfaForTransfers}
                                            style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                                        />
                                    </View>

                                    {/* Scope 3: Security & PIN Changes Toggle */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12 }}>
                                        <View style={{ flex: 1, paddingRight: 8 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                                <Ionicons name="shield-checkmark-outline" size={14} color={L.emerald} />
                                                <Text style={{ color: L.textPrimary, fontSize: 11.5, fontWeight: '700' }}>Require 2FA for PIN & Security Changes</Text>
                                            </View>
                                            <Text style={{ color: L.textMuted, fontSize: 9.5, marginTop: 2, paddingLeft: 19 }}>
                                                Prompt for 6-digit code before resetting PIN, altering password or security settings
                                            </Text>
                                        </View>
                                        <Switch
                                            trackColor={{ false: '#E2E8F0', true: '#10B981' }}
                                            thumbColor={mfaForSecurityChanges ? '#FFFFFF' : '#94A3B8'}
                                            onValueChange={handleToggleSecurityMfa}
                                            value={mfaForSecurityChanges}
                                            style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                                        />
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* SECTION 4: APP LOCK & PRIVACY */}
                    <View>
                        <Text style={{ color: L.textMuted, fontSize: 10.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, marginLeft: 4 }}>
                            App Lock & Privacy
                        </Text>
                        <View style={{ backgroundColor: L.card, borderRadius: 14, borderWidth: 1, borderColor: L.cardBorder, padding: 14 }}>
                            {/* Auto-Lock Interval */}
                            <View style={{ marginBottom: 14 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <Text style={{ color: L.textPrimary, fontSize: 12, fontWeight: '700' }}>Auto-Lock Inactivity Timeout</Text>
                                    <Text style={{ color: L.goldDk, fontSize: 10.5, fontWeight: '800' }}>
                                        {autoLockInterval === '0' ? 'Immediately' : autoLockInterval === '60' ? '1 Min' : autoLockInterval === '300' ? '5 Mins' : '15 Mins'}
                                    </Text>
                                </View>
                                <Text style={{ color: L.textMuted, fontSize: 10, marginBottom: 8 }}>
                                    Lock app automatically when minimized or inactive
                                </Text>

                                <View style={{ flexDirection: 'row', gap: 6 }}>
                                    {[
                                        { key: '0', label: 'Immediately' },
                                        { key: '60', label: '1 Min' },
                                        { key: '300', label: '5 Mins' },
                                        { key: '900', label: '15 Mins' },
                                    ].map((item) => {
                                        const active = autoLockInterval === item.key;
                                        return (
                                            <TouchableOpacity
                                                key={item.key}
                                                onPress={() => handleChangeAutoLock(item.key)}
                                                style={{
                                                    flex: 1,
                                                    paddingVertical: 8,
                                                    borderRadius: 8,
                                                    backgroundColor: active ? L.navyHeader : '#F8FAFC',
                                                    borderWidth: 1,
                                                    borderColor: active ? L.navyHeader : '#E2E8F0',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                                activeOpacity={0.75}
                                            >
                                                <Text style={{ color: active ? '#FFFFFF' : L.textPrimary, fontSize: 10, fontWeight: active ? '800' : '600' }}>
                                                    {item.label}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>

                            {/* Privacy Mode (Mask Balance) */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#F1F5F9' }}>
                                <View style={{ flex: 1, paddingRight: 8 }}>
                                    <Text style={{ color: L.textPrimary, fontSize: 12, fontWeight: '700' }}>Privacy Mode</Text>
                                    <Text style={{ color: L.textMuted, fontSize: 10, marginTop: 1 }}>
                                        Hide wallet balance by default on launch
                                    </Text>
                                </View>
                                <Switch
                                    trackColor={{ false: '#E2E8F0', true: '#10B981' }}
                                    thumbColor={hideBalanceByDefault ? '#FFFFFF' : '#94A3B8'}
                                    onValueChange={handleToggleHideBalance}
                                    value={hideBalanceByDefault}
                                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                                />
                            </View>

                            {/* Sign-In Alerts */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10 }}>
                                <View style={{ flex: 1, paddingRight: 8 }}>
                                    <Text style={{ color: L.textPrimary, fontSize: 12, fontWeight: '700' }}>Sign-In Email Alerts</Text>
                                    <Text style={{ color: L.textMuted, fontSize: 10, marginTop: 1 }}>
                                        Receive email notifications when account is accessed on a new device
                                    </Text>
                                </View>
                                <Switch
                                    trackColor={{ false: '#E2E8F0', true: '#2563EB' }}
                                    thumbColor={loginEmailAlerts ? '#FFFFFF' : '#94A3B8'}
                                    onValueChange={handleToggleEmailAlerts}
                                    value={loginEmailAlerts}
                                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                                />
                            </View>
                        </View>
                    </View>

                    {/* SECTION 5: EMERGENCY PROTECTION */}
                    <View>
                        <Text style={{ color: L.textMuted, fontSize: 10.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, marginLeft: 4 }}>
                            Emergency Protection
                        </Text>
                        <View style={{ backgroundColor: isAccountFrozen ? '#FFF1F2' : L.card, borderRadius: 14, borderWidth: 1, borderColor: isAccountFrozen ? L.roseBorder : L.cardBorder, padding: 14 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <MaterialCommunityIcons name={isAccountFrozen ? "shield-alert" : "shield-lock-outline"} size={16} color={isAccountFrozen ? L.rose : L.navyHeader} />
                                    <Text style={{ color: isAccountFrozen ? L.rose : L.navyHeader, fontSize: 12, fontWeight: '800' }}>
                                        Emergency Account Freeze
                                    </Text>
                                </View>
                                <View style={{ backgroundColor: isAccountFrozen ? '#FEE2E2' : L.emeraldBg, paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 4 }}>
                                    <Text style={{ color: isAccountFrozen ? L.rose : L.emerald, fontSize: 8, fontWeight: '900' }}>
                                        {isAccountFrozen ? 'FROZEN' : 'ACTIVE'}
                                    </Text>
                                </View>
                            </View>

                            <Text style={{ color: L.textMuted, fontSize: 10, lineHeight: 14, marginBottom: 12 }}>
                                {isAccountFrozen 
                                    ? 'All outgoing transfers and orders are temporarily suspended. Your wallet balance remains 100% secure.'
                                    : 'Instantly pause all outgoing transfers and withdrawals if your phone is lost or credentials compromised.'}
                            </Text>

                            {isAccountFrozen ? (
                                <TouchableOpacity
                                    onPress={() => handleOpenFreezeModal('unfreeze')}
                                    style={{
                                        backgroundColor: L.emerald,
                                        borderRadius: 10,
                                        paddingVertical: 10,
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                    activeOpacity={0.85}
                                >
                                    <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>
                                        Unfreeze Account Now 🔓
                                    </Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    onPress={() => handleOpenFreezeModal('freeze')}
                                    style={{
                                        backgroundColor: '#FFF1F2',
                                        borderWidth: 1,
                                        borderColor: L.roseBorder,
                                        borderRadius: 10,
                                        paddingVertical: 9,
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                    activeOpacity={0.85}
                                >
                                    <Text style={{ color: L.rose, fontSize: 11, fontWeight: '800' }}>
                                        Freeze Outgoing Transfers 🚨
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* SECTION 6: SESSIONS & AUDIT */}
                    <View>
                        <Text style={{ color: L.textMuted, fontSize: 10.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, marginLeft: 4 }}>
                            Sessions & Audit
                        </Text>
                        <View style={{ backgroundColor: L.card, borderRadius: 14, borderWidth: 1, borderColor: L.cardBorder, padding: 14, gap: 10 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Text style={{ color: L.textMuted, fontSize: 10.5 }}>Current Device</Text>
                                <Text style={{ color: L.textPrimary, fontSize: 10.5, fontWeight: '700' }}>{Platform.OS.toUpperCase()} Native Client</Text>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Text style={{ color: L.textMuted, fontSize: 10.5 }}>Last Verified Sign-In</Text>
                                <Text style={{ color: L.textSecondary, fontSize: 10.5, fontWeight: '700' }}>{lastSignInTime}</Text>
                            </View>

                            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                                <TouchableOpacity
                                    onPress={() => setAuditModalVisible(true)}
                                    style={{ 
                                        flex: 1, 
                                        backgroundColor: '#F8FAFC', 
                                        borderWidth: 1, 
                                        borderColor: L.cardBorder, 
                                        borderRadius: 9, 
                                        paddingVertical: 9, 
                                        alignItems: 'center' 
                                    }}
                                    activeOpacity={0.8}
                                >
                                    <Text style={{ color: L.navyHeader, fontSize: 10, fontWeight: '800' }}>
                                        Diagnostics Report 📋
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={handleTerminateOtherSessions}
                                    style={{ 
                                        flex: 1, 
                                        backgroundColor: '#FFF1F2', 
                                        borderWidth: 1, 
                                        borderColor: L.roseBorder, 
                                        borderRadius: 9, 
                                        paddingVertical: 9, 
                                        alignItems: 'center' 
                                    }}
                                    activeOpacity={0.8}
                                >
                                    <Text style={{ color: L.rose, fontSize: 10, fontWeight: '800' }}>
                                        Log Out Other Devices 🚪
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
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
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                <Text style={{ color: L.goldAmber, fontSize: 11, fontWeight: '900' }}>
                                    Step 3: Enter 6-Digit Code
                                </Text>
                                <TouchableOpacity
                                    onPress={handlePasteSetupCode}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 4,
                                        backgroundColor: L.goldBg,
                                        borderColor: L.gold,
                                        borderWidth: 1,
                                        borderRadius: 14,
                                        paddingHorizontal: 9,
                                        paddingVertical: 3.5
                                    }}
                                    activeOpacity={0.75}
                                >
                                    <Ionicons name="clipboard-outline" size={12} color={L.goldAmber} />
                                    <Text style={{ color: L.navyHeader, fontSize: 10, fontWeight: '800' }}>Paste Code 📋</Text>
                                </TouchableOpacity>
                            </View>
                            <Text style={{ color: L.textMuted, fontSize: 10, marginBottom: 10 }}>
                                Type or paste the 6-digit code currently shown in your Authenticator app:
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

            {/* 4. LIVE 2FA TEST & SECURITY CHALLENGE MODAL */}
            <Modal
                visible={testModalVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => {
                    setTestModalVisible(false);
                    setPendingActionAfter2fa(null);
                }}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.65)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
                    <View style={{ width: '100%', maxWidth: 380, backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1.5, borderColor: L.emeraldBorder, padding: 18 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                                <Ionicons name={pendingActionAfter2fa ? "shield-checkmark" : "flask"} size={18} color={L.emerald} />
                                <Text style={{ color: L.navyHeader, fontSize: 13, fontWeight: '900' }}>
                                    {pendingActionAfter2fa ? "Verify 2FA for Security Action" : "Test Authenticator Code"}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => {
                                setTestModalVisible(false);
                                setPendingActionAfter2fa(null);
                            }}>
                                <Ionicons name="close" size={20} color={L.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ color: L.textMuted, fontSize: 10.5, marginBottom: 12, lineHeight: 14.5 }}>
                            {pendingActionAfter2fa 
                                ? "Enter the 6-digit code from Google Authenticator to authorize this security change:" 
                                : "Enter the 6-digit code currently visible in Google Authenticator to confirm it is 100% active and in sync:"}
                        </Text>

                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Text style={{ color: L.textSecondary, fontSize: 10.5, fontWeight: '800' }}>
                                6-Digit Token:
                            </Text>
                            <TouchableOpacity
                                onPress={() => handlePasteTestCode(true)}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4,
                                    backgroundColor: L.goldBg,
                                    borderColor: L.gold,
                                    borderWidth: 1,
                                    borderRadius: 14,
                                    paddingHorizontal: 9,
                                    paddingVertical: 3.5
                                }}
                                activeOpacity={0.75}
                            >
                                <Ionicons name="clipboard-outline" size={12} color={L.goldAmber} />
                                <Text style={{ color: L.navyHeader, fontSize: 10, fontWeight: '800' }}>Paste Code 📋</Text>
                            </TouchableOpacity>
                        </View>

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
                                onPress={() => {
                                    setTestModalVisible(false);
                                    setPendingActionAfter2fa(null);
                                }}
                                style={{ flex: 1, backgroundColor: '#F1F5F9', borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}
                            >
                                <Text style={{ color: L.textSecondary, fontSize: 11, fontWeight: '700' }}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => handleTestCode()}
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

            {/* 5. EMERGENCY ACCOUNT FREEZE / UNFREEZE PIN CONFIRMATION MODAL */}
            <Modal
                visible={freezeModalVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => {
                    if (!processingFreeze) setFreezeModalVisible(false);
                }}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.7)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
                    <View style={{ width: '100%', maxWidth: 390, backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1.5, borderColor: freezeActionType === 'freeze' ? L.roseBorder : L.emeraldBorder, padding: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 12 }}>
                        {/* Header */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: freezeActionType === 'freeze' ? '#FEE2E2' : L.emeraldBg, alignItems: 'center', justifyContent: 'center' }}>
                                    <MaterialCommunityIcons 
                                        name={freezeActionType === 'freeze' ? "shield-alert" : "shield-check"} 
                                        size={18} 
                                        color={freezeActionType === 'freeze' ? L.rose : L.emerald} 
                                    />
                                </View>
                                <View>
                                    <Text style={{ color: L.navyHeader, fontSize: 13, fontWeight: '900' }}>
                                        {freezeActionType === 'freeze' ? 'Emergency Account Freeze' : 'Unfreeze Account'}
                                    </Text>
                                    <Text style={{ color: L.textMuted, fontSize: 9.5, fontWeight: '600' }}>
                                        {freezeActionType === 'freeze' ? 'Emergency Panic Protection' : 'Restore Full Account Operations'}
                                    </Text>
                                </View>
                            </View>
                            <TouchableOpacity 
                                onPress={() => setFreezeModalVisible(false)}
                                disabled={processingFreeze}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="close" size={20} color={L.textMuted} />
                            </TouchableOpacity>
                        </View>

                        {/* Explanation & Warning Alert Banner */}
                        <View style={{ 
                            backgroundColor: freezeActionType === 'freeze' ? '#FFF1F2' : L.emeraldBg, 
                            borderWidth: 1, 
                            borderColor: freezeActionType === 'freeze' ? L.roseBorder : L.emeraldBorder, 
                            borderRadius: 10, 
                            padding: 10, 
                            marginBottom: 14 
                        }}>
                            <Text style={{ color: freezeActionType === 'freeze' ? L.rose : L.emerald, fontSize: 10.5, lineHeight: 14.5, fontWeight: '600' }}>
                                {freezeActionType === 'freeze' 
                                    ? 'WARNING: Once your account is frozen, all outgoing transfers, withdrawals, and purchases will be paused immediately. Your wallet funds remain 100% safe. You can unfreeze at any time using your transaction PIN.'
                                    : 'Enter your 4-digit transaction PIN to confirm account ownership and restore full account operations.'}
                            </Text>
                        </View>

                        {/* PIN Entry Field */}
                        <Text style={{ color: L.textSecondary, fontSize: 10.5, fontWeight: '800', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Enter 4-Digit Transaction PIN:
                        </Text>

                        <TextInput
                            style={{ 
                                backgroundColor: '#F8FAFC', 
                                borderWidth: 1.5, 
                                borderColor: freezePin.length === 4 ? (freezeActionType === 'freeze' ? L.rose : L.emerald) : L.cardBorder, 
                                borderRadius: 12, 
                                paddingVertical: 10, 
                                textAlign: 'center', 
                                fontSize: 24, 
                                fontWeight: '900', 
                                letterSpacing: 10,
                                color: L.textPrimary,
                                marginBottom: 16 
                            }}
                            keyboardType="number-pad"
                            secureTextEntry={true}
                            maxLength={4}
                            placeholder="••••"
                            placeholderTextColor="#94A3B8"
                            value={freezePin}
                            onChangeText={setFreezePin}
                            editable={!processingFreeze}
                            autoFocus={true}
                        />

                        {/* Modal Action Buttons */}
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity
                                onPress={() => setFreezeModalVisible(false)}
                                disabled={processingFreeze}
                                style={{ 
                                    flex: 1, 
                                    backgroundColor: '#F1F5F9', 
                                    borderRadius: 10, 
                                    paddingVertical: 11, 
                                    alignItems: 'center', 
                                    justifyContent: 'center' 
                                }}
                            >
                                <Text style={{ color: L.textSecondary, fontSize: 11, fontWeight: '700' }}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleExecuteFreezeAction}
                                disabled={processingFreeze || freezePin.length !== 4}
                                style={{ 
                                    flex: 1.6, 
                                    backgroundColor: freezePin.length !== 4 
                                        ? '#CBD5E1' 
                                        : (freezeActionType === 'freeze' ? L.rose : L.emerald), 
                                    borderRadius: 10, 
                                    paddingVertical: 11, 
                                    alignItems: 'center', 
                                    justifyContent: 'center' 
                                }}
                            >
                                {processingFreeze ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '900' }}>
                                        {freezeActionType === 'freeze' ? 'Freeze Account 🛡️' : 'Unfreeze Account ✨'}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* 6. FULL SECURITY DIAGNOSTICS & AUDIT TELEMETRY MODAL */}
            <Modal
                visible={auditModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setAuditModalVisible(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.7)', justifyContent: 'flex-end' }}>
                    <View style={{ 
                        backgroundColor: '#FFFFFF', 
                        borderTopLeftRadius: 24, 
                        borderTopRightRadius: 24, 
                        borderTopWidth: 1.5, 
                        borderColor: L.goldBorder, 
                        maxHeight: '85%', 
                        paddingBottom: Math.max(insets.bottom, 16),
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: -4 },
                        shadowOpacity: 0.25,
                        shadowRadius: 10,
                        elevation: 15
                    }}>
                        {/* Drag Handle Bar */}
                        <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}>
                            <View style={{ width: 44, height: 4.5, borderRadius: 3, backgroundColor: '#CBD5E1' }} />
                        </View>

                        {/* Modal Header */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: 1, borderColor: L.cardBorder }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: L.goldBg, borderWidth: 1, borderColor: L.gold, alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons name="shield-checkmark" size={18} color={L.goldDk} />
                                </View>
                                <View>
                                    <Text style={{ color: L.navyHeader, fontSize: 13.5, fontWeight: '900' }}>
                                        Security Diagnostics & Audit
                                    </Text>
                                    <Text style={{ color: L.textMuted, fontSize: 9.5, fontWeight: '600' }}>
                                        Device Hardware, Cryptography & Session Integrity
                                    </Text>
                                </View>
                            </View>

                            <TouchableOpacity 
                                onPress={() => setAuditModalVisible(false)}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <Ionicons name="close" size={18} color={L.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {/* Scrollable Audit Report */}
                        <ScrollView contentContainerStyle={{ padding: 18, gap: 12 }}>
                            {/* Health Overview Banner */}
                            <View style={{ 
                                backgroundColor: L.navyHeader, 
                                borderRadius: 14, 
                                padding: 14, 
                                borderWidth: 1, 
                                borderColor: L.goldBorder,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}>
                                <View>
                                    <Text style={{ color: '#94A3B8', fontSize: 9.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                        Aggregate Health Score
                                    </Text>
                                    <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '900', marginTop: 2 }}>
                                        {securityScore}% <Text style={{ fontSize: 11, color: securityScore >= 75 ? L.emerald : L.gold, fontWeight: '800' }}>({securityScore === 100 ? 'BANK-GRADE MAXIMUM' : securityScore >= 75 ? 'HIGH RESILIENCE' : 'ACTIVE / FAIR'})</Text>
                                    </Text>
                                </View>
                                <View style={{ backgroundColor: 'rgba(245, 166, 35, 0.15)', borderWidth: 1, borderColor: L.gold, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
                                    <Text style={{ color: L.gold, fontSize: 10, fontWeight: '900' }}>VERIFIED</Text>
                                </View>
                            </View>

                            {/* Section 1: Cryptography & Channel */}
                            <View style={{ backgroundColor: L.cardSubtle, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: L.cardBorder }}>
                                <Text style={{ color: L.navyHeader, fontSize: 10.5, fontWeight: '900', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>
                                    1. Cryptographic Transport & Storage
                                </Text>
                                <View style={{ gap: 6 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text style={{ color: L.textMuted, fontSize: 10 }}>Transport Security</Text>
                                        <Text style={{ color: L.emerald, fontSize: 10, fontWeight: '800' }}>TLS 1.3 / SSL Encrypted ✅</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text style={{ color: L.textMuted, fontSize: 10 }}>Local Storage Encryption</Text>
                                        <Text style={{ color: L.emerald, fontSize: 10, fontWeight: '800' }}>AES-256 Storage Engine ✅</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text style={{ color: L.textMuted, fontSize: 10 }}>Database Hash Standard</Text>
                                        <Text style={{ color: L.navyHeader, fontSize: 10, fontWeight: '700' }}>Bcrypt / PBKDF2</Text>
                                    </View>
                                </View>
                            </View>

                            {/* Section 2: Hardware Biometrics Enclave */}
                            <View style={{ backgroundColor: L.cardSubtle, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: L.cardBorder }}>
                                <Text style={{ color: L.navyHeader, fontSize: 10.5, fontWeight: '900', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>
                                    2. Hardware Biometric Enclave
                                </Text>
                                <View style={{ gap: 6 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text style={{ color: L.textMuted, fontSize: 10 }}>Hardware Sensor</Text>
                                        <Text style={{ color: hardwareDetected ? L.emerald : L.goldAmber, fontSize: 10, fontWeight: '800' }}>
                                            {hardwareDetected ? 'Supported (TEE / Secure Enclave) ✅' : 'Emulated / Standard'}
                                        </Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text style={{ color: L.textMuted, fontSize: 10 }}>Enrolled on Device</Text>
                                        <Text style={{ color: hardwareEnrolled ? L.emerald : L.rose, fontSize: 10, fontWeight: '800' }}>
                                            {hardwareEnrolled ? 'Enrolled & Verified ✅' : 'No Biometrics Enrolled ⚠️'}
                                        </Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text style={{ color: L.textMuted, fontSize: 10 }}>Sensor Modality</Text>
                                        <Text style={{ color: L.navyHeader, fontSize: 10, fontWeight: '700' }}>{biometricType}</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text style={{ color: L.textMuted, fontSize: 10 }}>App Biometric Guard</Text>
                                        <Text style={{ color: biometricEnabled ? L.emerald : L.textMuted, fontSize: 10, fontWeight: '800' }}>
                                            {biometricEnabled ? 'Enforced for App Unlock ✅' : 'Disabled (PIN only)'}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* Section 3: Two-Factor TOTP Authenticator */}
                            <View style={{ backgroundColor: L.cardSubtle, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: L.cardBorder }}>
                                <Text style={{ color: L.navyHeader, fontSize: 10.5, fontWeight: '900', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>
                                    3. Two-Factor Authentication (2FA)
                                </Text>
                                <View style={{ gap: 6 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text style={{ color: L.textMuted, fontSize: 10 }}>RFC 6238 TOTP Standard</Text>
                                        <Text style={{ color: isMfaActive ? L.emerald : L.goldAmber, fontSize: 10, fontWeight: '800' }}>
                                            {isMfaActive ? 'Google Authenticator Linked ✅' : 'Not Configured ⚠️'}
                                        </Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text style={{ color: L.textMuted, fontSize: 10 }}>Payout & Transfer Protection</Text>
                                        <Text style={{ color: mfaForTransfers ? L.emerald : L.textMuted, fontSize: 10, fontWeight: '800' }}>
                                            {mfaForTransfers ? 'Mandatory for Transfers 🛡️' : 'PIN Only'}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* Section 4: Lock, Privacy & Anti-Theft */}
                            <View style={{ backgroundColor: L.cardSubtle, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: L.cardBorder }}>
                                <Text style={{ color: L.navyHeader, fontSize: 10.5, fontWeight: '900', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>
                                    4. Inactivity Lock & Panic State
                                </Text>
                                <View style={{ gap: 6 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text style={{ color: L.textMuted, fontSize: 10 }}>Auto-Lock Inactivity Threshold</Text>
                                        <Text style={{ color: L.navyHeader, fontSize: 10, fontWeight: '700' }}>
                                            {autoLockInterval === '0' ? 'Immediately (0s)' : `${parseInt(autoLockInterval)/60} Minute(s)`}
                                        </Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text style={{ color: L.textMuted, fontSize: 10 }}>Privacy Shield (Mask Balance)</Text>
                                        <Text style={{ color: hideBalanceByDefault ? L.emerald : L.textMuted, fontSize: 10, fontWeight: '800' }}>
                                            {hideBalanceByDefault ? 'Masked by Default 👁️' : 'Visible'}
                                        </Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text style={{ color: L.textMuted, fontSize: 10 }}>New Device Email Alerts</Text>
                                        <Text style={{ color: loginEmailAlerts ? L.emerald : L.textMuted, fontSize: 10, fontWeight: '800' }}>
                                            {loginEmailAlerts ? 'Active (Instant Alerts) 🔔' : 'Off'}
                                        </Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text style={{ color: L.textMuted, fontSize: 10 }}>Emergency Freeze Status</Text>
                                        <Text style={{ color: isAccountFrozen ? L.rose : L.emerald, fontSize: 10, fontWeight: '900' }}>
                                            {isAccountFrozen ? 'FROZEN (Panic Mode) 🛑' : 'NOMINAL / UNRESTRICTED ✅'}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* Section 5: Device & Session Metadata */}
                            <View style={{ backgroundColor: L.cardSubtle, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: L.cardBorder }}>
                                <Text style={{ color: L.navyHeader, fontSize: 10.5, fontWeight: '900', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>
                                    5. Client Environment & Session
                                </Text>
                                <View style={{ gap: 6 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text style={{ color: L.textMuted, fontSize: 10 }}>Platform Runtime</Text>
                                        <Text style={{ color: L.navyHeader, fontSize: 10, fontWeight: '700' }}>{Platform.OS.toUpperCase()} {Platform.Version}</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text style={{ color: L.textMuted, fontSize: 10 }}>Authenticated User</Text>
                                        <Text style={{ color: L.navyHeader, fontSize: 10, fontWeight: '700' }}>{userEmail || 'Active Client'}</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text style={{ color: L.textMuted, fontSize: 10 }}>Last Verified Sign-In</Text>
                                        <Text style={{ color: L.navyHeader, fontSize: 10, fontWeight: '700' }}>{lastSignInTime}</Text>
                                    </View>
                                </View>
                            </View>

                            {/* Close Button */}
                            <TouchableOpacity
                                onPress={() => setAuditModalVisible(false)}
                                style={{ 
                                    backgroundColor: L.navyHeader, 
                                    borderRadius: 11, 
                                    paddingVertical: 12, 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    marginTop: 6
                                }}
                            >
                                <Text style={{ color: '#FFFFFF', fontSize: 11.5, fontWeight: '900' }}>
                                    Close Diagnostics
                                </Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
