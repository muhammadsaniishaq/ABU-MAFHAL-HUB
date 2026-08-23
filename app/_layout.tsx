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

// Configure Reanimated Logger to be less chatty
configureReanimatedLogger({
    strict: false,
    level: ReanimatedLogLevel.warn,
});

// Suppress other noisy warnings
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

// Suppress browser focus outlines & set up PWA manifest globally across web app
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

    // PWA Manifest and Mobile App Meta Tags Setup
    const manifestId = 'pwa-manifest-link';
    if (!document.getElementById(manifestId)) {
      const manifestLink = document.createElement('link');
      manifestLink.id = manifestId;
      manifestLink.rel = 'manifest';
      manifestLink.href = '/manifest.json';
      document.head.appendChild(manifestLink);

      const metaTheme = document.createElement('meta');
      metaTheme.name = 'theme-color';
      metaTheme.content = '#0F172A';
      document.head.appendChild(metaTheme);

      const metaMobile = document.createElement('meta');
      metaMobile.name = 'mobile-web-app-capable';
      metaMobile.content = 'yes';
      document.head.appendChild(metaMobile);

      const metaApple = document.createElement('meta');
      metaApple.name = 'apple-mobile-web-app-capable';
      metaApple.content = 'yes';
      document.head.appendChild(metaApple);

      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (let reg of registrations) {
            reg.unregister();
          }
        }).catch(() => {});
      }
    }
  } catch (e) {}
}

// Ultra-fast Native Splash dismiss to eliminate any splash freezing
if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch(() => {});
  // Failsafe auto-hide timeout: guarantees screen never stays stuck on native splash
  setTimeout(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, 350);
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
    const [initialized, setInitialized] = useState(true);
    const [authChecked, setAuthChecked] = useState(true);
    const router = useRouter();
    const segments = useSegments();
    const { settings } = useAppSettings();

    const KNOWN_ADMIN_EMAILS = ['sale.abumafhal@gmail.com', 'admin@abumafhal.com', 'abumafhal@gmail.com'];

    const fetchUserRole = async (userId: string, userEmail?: string | null) => {
        try {
            const lowerEmail = userEmail ? userEmail.toLowerCase().trim() : '';
            const isAdminEmail = lowerEmail && KNOWN_ADMIN_EMAILS.includes(lowerEmail);

            // Load from cache first
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
                if (data && data.role !== 'admin') {
                    try { await supabase.from('profiles').update({ role: 'admin' }).eq('id', userId); } catch (err) {}
                }
            } else {
                if (data && data.role === 'admin' && !isConfirmedAdmin) {
                    roleToSet = 'user';
                    try { await supabase.from('profiles').update({ role: 'user' }).eq('id', userId); } catch (err) {}
                } else if (!roleToSet) {
                    roleToSet = 'user';
                }
            }

            setUserRole(roleToSet);
            await AsyncStorage.setItem(`user_role_${userId}`, roleToSet);
        } catch (e) {
            console.log('Error fetching role in layout:', e);
        }
    };

    useEffect(() => {
        // Fast synchronous check of cached session
        AsyncStorage.getItem('has_active_session').then((hasSession) => {
            if (hasSession === 'true') {
                setInitialized(true);
            }
        }).catch(() => {});

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
            setInitialized(true);
            SplashScreen.hideAsync().catch(() => {});
        }).catch(async () => {
            setAuthChecked(true);
            setInitialized(true);
            SplashScreen.hideAsync().catch(() => {});
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

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'background' || nextAppState === 'inactive') {
                // Immediately lock session on app exit or minimize
                AsyncStorage.removeItem('app_unlocked').catch(() => {});
            } else if (nextAppState === 'active') {
                // When returning to app, instantly ensure PIN unlock is shown
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

    // High performance route guard with local caching (no blocking network calls)
    useEffect(() => {
        if (!initialized || !authChecked) return;

        const currentScreen = segments[segments.length - 1] || 'index';
        const authScreens = ['login', 'signup', 'pin', 'pin-setup', 'otp'];
        const isAuthGroup = segments.includes('(auth)') || authScreens.includes(currentScreen);
        const isManagementGroup = segments.includes('manage') || segments[0] === 'manage' || segments[0] === '(manage)';
        const publicScreens = ['index', 'onboarding', 'privacy', 'terms', 'signup'];
        const isPublicScreen = publicScreens.includes(currentScreen);

        if (session) {
            const isAdmin = isUserAdmin(userRole, session.user?.email);

            (async () => {
                const userId = session.user.id;
                const unlocked = await AsyncStorage.getItem('app_unlocked');
                
                // Read PIN locally from secure cache instantly
                let localPin = Platform.OS === 'web'
                    ? await AsyncStorage.getItem(`user_transaction_pin_${userId}`) || await AsyncStorage.getItem('user_transaction_pin')
                    : await SecureStore.getItemAsync(`user_transaction_pin_${userId}`) || await SecureStore.getItemAsync('user_transaction_pin');

                // 1. User has NO PIN configured -> Must complete PIN Setup first!
                if (!localPin) {
                    // Check DB in background once
                    (async () => {
                        try {
                            const { data } = await supabase.from('profiles').select('transaction_pin').eq('id', userId).maybeSingle();
                            if (data?.transaction_pin) {
                                const validPin = String(data.transaction_pin);
                                if (Platform.OS === 'web') await AsyncStorage.setItem(`user_transaction_pin_${userId}`, validPin);
                                else await SecureStore.setItemAsync(`user_transaction_pin_${userId}`, validPin);
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
                    if (currentScreen !== 'pin' && currentScreen !== 'pin-setup' && currentScreen !== 'otp') {
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
    }, [session, userRole, initialized, segments, authChecked]);

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
