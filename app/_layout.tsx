import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useRef } from 'react';
import 'react-native-reanimated';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';
import { View, ActivityIndicator, LogBox, Platform, AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// Configure Reanimated Logger
configureReanimatedLogger({
    strict: false,
    level: ReanimatedLogLevel.warn,
});

// Suppress noisy logs
LogBox.ignoreLogs([
    'SafeAreaView has been deprecated',
    '[Reanimated] Reading from `value`',
    'setLayoutAnimationEnabledExperimental is currently a no-op',
    'AuthApiError: Invalid Refresh Token',
    '[AuthApiError: Invalid Refresh Token',
    'Invalid Refresh Token: Refresh Token Not Found',
    '[expo-av]: Expo AV has been deprecated',
]);

import { supabase, forceSignOut } from '../services/supabase';
import { Session } from '@supabase/supabase-js';
import { useColorScheme } from '@/hooks/useColorScheme';
import '../global.css';

// Web setup
if (typeof document !== 'undefined') {
  try {
    const styleId = 'global-outline-suppress';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        input, textarea, select, button, [contenteditable="true"] {
          outline: none !important;
          box-shadow: none !important;
          -webkit-tap-highlight-color: transparent !important;
        }
        *:focus {
          outline: none !important;
        }
      `;
      document.head.appendChild(style);
    }
  } catch (e) {}
}

// Auto-hide native splash immediately so screen never stays blank or frozen
if (Platform.OS !== 'web') {
  SplashScreen.hideAsync().catch(() => {});
}

import { useAppSettings } from '../hooks/useAppSettings';
import MaintenanceScreen from '../components/MaintenanceScreen';
import UpdateScreen from '../components/UpdateScreen';

const isUserAdmin = (role?: string | null, email?: string | null) => {
    if (role === 'admin' || role === 'super_admin') return true;
    const lowerEmail = email ? email.toLowerCase().trim() : '';
    if (!lowerEmail) return false;
    return (
        lowerEmail === 'sale.abumafhal@gmail.com' ||
        lowerEmail === 'admin@abumafhal.com' ||
        lowerEmail === 'abumafhal@gmail.com' ||
        lowerEmail.endsWith('@abumafhal.com') ||
        lowerEmail.endsWith('@abumafhal.com.ng') ||
        lowerEmail.includes('admin')
    );
};

export default function RootLayout() {
    const colorScheme = useColorScheme();
    const [session, setSession] = useState<Session | null>(null);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [authChecked, setAuthChecked] = useState(false);
    const router = useRouter();
    const segments = useSegments();
    const { settings } = useAppSettings();

    const KNOWN_ADMIN_EMAILS = ['sale.abumafhal@gmail.com', 'admin@abumafhal.com', 'abumafhal@gmail.com'];

    const fetchUserRole = async (userId: string, userEmail?: string | null) => {
        try {
            const lowerEmail = userEmail ? userEmail.toLowerCase().trim() : '';
            const isAdminEmail = lowerEmail && KNOWN_ADMIN_EMAILS.includes(lowerEmail);

            const cachedRole = await AsyncStorage.getItem(`user_role_${userId}`);
            if (cachedRole && !userRole) {
                setUserRole(cachedRole);
            }

            const { data } = await supabase
                .from('profiles')
                .select('role, email')
                .eq('id', userId)
                .maybeSingle();
            
            let roleToSet = data?.role;
            const profileEmail = (data?.email || userEmail || '').toLowerCase().trim();
            const isConfirmedAdmin = profileEmail && KNOWN_ADMIN_EMAILS.includes(profileEmail);

            if (isConfirmedAdmin) {
                roleToSet = 'admin';
            } else if (!roleToSet) {
                roleToSet = 'user';
            }

            setUserRole(roleToSet);
            await AsyncStorage.setItem(`user_role_${userId}`, roleToSet);
        } catch (e) {}
    };

    useEffect(() => {
        supabase.auth.getSession().then(async ({ data: { session }, error }) => {
            if (error) {
                if (error.message?.includes('Refresh Token') || error.message?.includes('refresh_token')) {
                    await forceSignOut();
                    await AsyncStorage.removeItem('has_active_session');
                }
                setSession(null);
            } else {
                setSession(session);
                if (session?.user) {
                    await AsyncStorage.setItem('has_active_session', 'true');
                    const cached = await AsyncStorage.getItem(`user_role_${session.user.id}`);
                    if (cached) setUserRole(cached);
                    fetchUserRole(session.user.id, session.user.email);
                } else {
                    await AsyncStorage.removeItem('has_active_session');
                }
            }
            setAuthChecked(true);
            if (Platform.OS !== 'web') SplashScreen.hideAsync().catch(() => {});
        }).catch(async () => {
            setAuthChecked(true);
            if (Platform.OS !== 'web') SplashScreen.hideAsync().catch(() => {});
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            setSession(session);
            if (session?.user) {
                await AsyncStorage.setItem('has_active_session', 'true');
                const cached = await AsyncStorage.getItem(`user_role_${session.user.id}`);
                if (cached) setUserRole(cached);
                fetchUserRole(session.user.id, session.user.email);
            } else {
                await AsyncStorage.removeItem('has_active_session');
                setUserRole(null);
            }
            setAuthChecked(true);
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    // Strict Security PIN Lock on native app exit/minimize
    useEffect(() => {
        if (Platform.OS === 'web') return;

        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'background' || nextAppState === 'inactive') {
                AsyncStorage.removeItem('app_unlocked').catch(() => {});
            } else if (nextAppState === 'active') {
                AsyncStorage.getItem('has_active_session').then(async (hasActive) => {
                    if (hasActive === 'true') {
                        const unlocked = await AsyncStorage.getItem('app_unlocked');
                        if (unlocked !== 'true') {
                            const currentScreen = segments[segments.length - 1] || 'index';
                            if (currentScreen !== 'pin' && currentScreen !== 'pin-setup' && currentScreen !== 'otp' && currentScreen !== 'login' && currentScreen !== 'signup') {
                                router.replace('/pin' as any);
                            }
                        }
                    }
                }).catch(() => {});
            }
        });
        return () => subscription.remove();
    }, [segments]);

    // Rock-solid Route Guard
    useEffect(() => {
        if (!authChecked) return;

        const currentScreen = segments[segments.length - 1] || 'index';
        const authScreens = ['login', 'signup', 'pin', 'pin-setup', 'otp', 'reset-password'];
        const isAuthGroup = segments.includes('(auth)') || authScreens.includes(currentScreen);
        const isManagementGroup = segments.includes('manage') || segments[0] === 'manage' || segments[0] === '(manage)';
        const publicScreens = ['index', 'onboarding', 'privacy', 'terms', 'signup', 'login'];
        const isPublicScreen = publicScreens.includes(currentScreen);

        if (session?.user) {
            const isAdmin = isUserAdmin(userRole, session.user?.email);

            (async () => {
                const userId = session.user.id;
                const unlocked = await AsyncStorage.getItem('app_unlocked');
                
                let localPin = Platform.OS === 'web'
                    ? await AsyncStorage.getItem(`user_transaction_pin_${userId}`) || await AsyncStorage.getItem('user_transaction_pin')
                    : await SecureStore.getItemAsync(`user_transaction_pin_${userId}`) || await SecureStore.getItemAsync('user_transaction_pin');

                // 1. User has NO PIN configured -> Must complete PIN Setup
                if (!localPin) {
                    (async () => {
                        try {
                            const { data } = await supabase.from('profiles').select('transaction_pin').eq('id', userId).maybeSingle();
                            if (data?.transaction_pin) {
                                const validPin = String(data.transaction_pin);
                                if (Platform.OS === 'web') await AsyncStorage.setItem(`user_transaction_pin_${userId}`, validPin);
                                else await SecureStore.setItemAsync(`user_transaction_pin_${userId}`, validPin);
                                if (unlocked !== 'true') router.replace('/pin' as any);
                                else router.replace('/dashboard' as any);
                            } else {
                                if (currentScreen !== 'pin-setup' && currentScreen !== 'otp') {
                                    router.replace('/pin-setup' as any);
                                }
                            }
                        } catch (err) {}
                    })();
                    return;
                }

                // 2. User has PIN, but app is LOCKED -> Prompt PIN unlock
                if (unlocked !== 'true') {
                    if (currentScreen !== 'pin' && currentScreen !== 'pin-setup' && currentScreen !== 'otp' && currentScreen !== 'login') {
                        router.replace('/pin' as any);
                    }
                    return;
                }

                // 3. User HAS PIN and app IS UNLOCKED -> Route to Dashboard
                if (isAuthGroup && !['otp', 'pin-setup', 'pin'].includes(currentScreen)) {
                    router.replace('/dashboard' as any);
                } else if (isManagementGroup && !isAdmin) {
                    router.replace('/dashboard' as any);
                } else if (currentScreen === 'index' || currentScreen === 'onboarding') {
                    router.replace('/dashboard' as any);
                }
            })().catch(() => {});
        } else {
            if (!isPublicScreen && !isAuthGroup) {
                router.replace('/');
            }
        }
    }, [session, userRole, authChecked, segments]);

    const isAdmin = userRole === 'admin' || userRole === 'super_admin';

    if (settings?.force_app_update) {
        return <UpdateScreen />;
    }

    if (settings?.maintenance_mode && !isAdmin) {
        return <MaintenanceScreen />;
    }

    return (
        <SafeAreaProvider>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="index" options={{ headerShown: false }} />
                    <Stack.Screen name="onboarding" options={{ headerShown: false }} />
                    <Stack.Screen name="privacy" options={{ headerShown: false }} />
                    <Stack.Screen name="terms" options={{ headerShown: false }} />
                    <Stack.Screen name="manage" options={{ headerShown: false }} />
                    <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                    <Stack.Screen name="(app)" options={{ headerShown: false }} />
                </Stack>
                <StatusBar style="auto" />
            </ThemeProvider>
        </SafeAreaProvider>
    );
}
