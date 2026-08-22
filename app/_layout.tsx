import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useRef } from 'react';
import 'react-native-reanimated';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';
import { View, ActivityIndicator, LogBox, Text, TextInput, Platform, AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';




// Configure Reanimated Logger to be less chatty about render phase value access
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

      // Unregister old service workers & clear stale caches to ensure immediate live updates
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (let reg of registrations) {
            reg.unregister();
          }
        }).catch(() => {});
        if (typeof caches !== 'undefined') {
          caches.keys().then((keys) => {
            for (let key of keys) {
              caches.delete(key);
            }
          }).catch(() => {});
        }
      }
    }
  } catch (e) {}
}

// Prevent the splash screen from auto-hiding before asset loading is complete (Mobile only)
if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch((e) => console.warn("SplashScreen preventAutoHideAsync failed:", e));
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
    const loaded = true;
    const [session, setSession] = useState<Session | null>(null);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [initialized, setInitialized] = useState(true);
    const [authChecked, setAuthChecked] = useState(true);
    const router = useRouter();
    const segments = useSegments();
    const { settings, loading: settingsLoading } = useAppSettings();

    const KNOWN_ADMIN_EMAILS = ['sale.abumafhal@gmail.com', 'admin@abumafhal.com', 'abumafhal@gmail.com'];

    const fetchUserRole = async (userId: string, userEmail?: string | null) => {
        try {
            const lowerEmail = userEmail ? userEmail.toLowerCase().trim() : '';
            const isAdminEmail = lowerEmail && KNOWN_ADMIN_EMAILS.includes(lowerEmail);

            // Load from cache first if state not set, keeping screen immediately interactive
            const cachedRole = await AsyncStorage.getItem(`user_role_${userId}`);
            if (cachedRole && !userRole) {
                setUserRole(cachedRole);
            }

            const { data, error } = await supabase
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
                // Ensure non-admin users are strictly 'user' and revert any accidental admin role in DB
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
        supabase.auth.getSession().then(async ({ data: { session }, error }) => {
            if (error) {
                console.log("Session init error returned:", error.message);
                if (error.message?.includes('Refresh Token') || error.message?.includes('refresh_token') || error.message?.includes('Refresh token')) {
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
        }).catch(async (error) => {
            console.log("Session init error thrown:", error?.message || error);
            if (error?.message?.includes('Refresh Token') || error?.message?.includes('refresh_token') || error?.message?.includes('Refresh token')) {
                await forceSignOut();
                await AsyncStorage.removeItem('has_active_session');
                setSession(null);
            }
            setAuthChecked(true);
            setInitialized(true);
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
        if (loaded && initialized && authChecked) {
            SplashScreen.hideAsync().catch(() => {});
        }
    }, [loaded, initialized, authChecked]);

    const backgroundTimeRef = useRef<number | null>(null);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'background' || nextAppState === 'inactive') {
                if (!backgroundTimeRef.current) {
                    backgroundTimeRef.current = Date.now();
                }
            } else if (nextAppState === 'active') {
                if (backgroundTimeRef.current) {
                    const elapsedMinutes = (Date.now() - backgroundTimeRef.current) / (1000 * 60);
                    // Lock session ONLY if user has been away in background for more than 10 minutes!
                    if (elapsedMinutes >= 10) {
                        AsyncStorage.removeItem('app_unlocked').catch(() => {});
                    }
                    backgroundTimeRef.current = null;
                }
            }
        });
        return () => subscription.remove();
    }, []);

    useEffect(() => {
        if (!initialized || !loaded || !authChecked) return;

        const currentScreen = segments[segments.length - 1] || 'index';
        const authScreens = ['login', 'signup', 'pin', 'pin-setup', 'otp'];
        const isAuthGroup = segments.includes('(auth)') || authScreens.includes(currentScreen);
        const isManagementGroup = segments.includes('manage') || segments[0] === 'manage' || segments[0] === '(manage)';

        const publicScreens = ['index', 'onboarding', 'privacy', 'terms', 'signup'];
        const isPublicScreen = publicScreens.includes(currentScreen);

        if (session) {
            const isAdmin = isUserAdmin(userRole, session.user?.email);

            AsyncStorage.getItem('app_unlocked').then(async (unlocked) => {
                const userId = session.user.id;
                let localPin = Platform.OS === 'web'
                    ? await AsyncStorage.getItem(`user_transaction_pin_${userId}`) || await AsyncStorage.getItem('user_transaction_pin')
                    : await SecureStore.getItemAsync(`user_transaction_pin_${userId}`) || await SecureStore.getItemAsync('user_transaction_pin');

                // Query database profile to ensure this specific user has a transaction PIN set
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('transaction_pin')
                    .eq('id', userId)
                    .maybeSingle();

                if (profileData) {
                    if (profileData.transaction_pin) {
                        localPin = profileData.transaction_pin;
                        if (Platform.OS === 'web') {
                            await AsyncStorage.setItem(`user_transaction_pin_${userId}`, localPin);
                            await AsyncStorage.setItem('user_transaction_pin', localPin);
                        } else {
                            await SecureStore.setItemAsync(`user_transaction_pin_${userId}`, localPin);
                            await SecureStore.setItemAsync('user_transaction_pin', localPin);
                        }
                    } else {
                        // User has no transaction_pin in DB -> Clear stale cached PIN
                        localPin = null;
                        await AsyncStorage.removeItem(`user_transaction_pin_${userId}`);
                        await AsyncStorage.removeItem('user_transaction_pin');
                    }
                }

                // 1. User has NO PIN configured -> Must complete PIN Setup first!
                if (!localPin) {
                    if (currentScreen !== 'pin-setup' && currentScreen !== 'otp') {
                        router.replace('/pin-setup' as any);
                    }
                    return;
                }

                // 2. User has PIN, but app is LOCKED (unlocked !== 'true') -> STRICT MANDATORY UNLOCK!
                if (unlocked !== 'true') {
                    if (currentScreen !== 'pin' && currentScreen !== 'pin-setup' && currentScreen !== 'otp') {
                        router.replace('/pin' as any);
                    }
                    return;
                }

                // 3. User HAS PIN and app IS UNLOCKED (unlocked === 'true')
                if (isAuthGroup && !['otp', 'pin-setup', 'pin'].includes(currentScreen)) {
                    router.replace('/dashboard' as any);
                } else if (isManagementGroup && !isAdmin) {
                    router.replace('/dashboard' as any);
                } else if (currentScreen === 'index' || currentScreen === 'onboarding') {
                    router.replace('/dashboard' as any);
                }
            }).catch(() => {});
        } else {
            if (!isPublicScreen && !isAuthGroup) {
                router.replace('/');
            }
        }
    }, [session, userRole, initialized, segments, loaded, authChecked]);

    if (!loaded || !initialized) {
        return (
            <View style={{ flex: 1, backgroundColor: '#030C22', alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="large" color="#f5a623" />
            </View>
        );
    }

    const isAdmin = userRole === 'admin' || userRole === 'super_admin';

    if (settings.force_app_update) {
        return <UpdateScreen />;
    }

    if (settings.maintenance_mode && !isAdmin) {
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
