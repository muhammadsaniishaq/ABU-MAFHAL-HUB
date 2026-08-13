import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';
import { View, ActivityIndicator, LogBox, Text, TextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';




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

      // Register PWA Service Worker
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('/sw.js').then(
            (reg) => console.log('PWA ServiceWorker active:', reg.scope),
            (err) => console.warn('PWA ServiceWorker error:', err)
          );
        });
      }
    }
  } catch (e) {}
}

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync().catch((e) => console.warn("SplashScreen preventAutoHideAsync failed:", e));

import { useAppSettings } from '../hooks/useAppSettings';
import MaintenanceScreen from '../components/MaintenanceScreen';
import UpdateScreen from '../components/UpdateScreen';

export default function RootLayout() {
    const colorScheme = useColorScheme();
    const [loaded] = useFonts({
        // SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    });
    const [session, setSession] = useState<Session | null>(null);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [initialized, setInitialized] = useState(false);
    const [authChecked, setAuthChecked] = useState(false);
    const router = useRouter();
    const segments = useSegments();
    const { settings, loading: settingsLoading } = useAppSettings();

    const KNOWN_ADMIN_EMAILS = ['sale.abumafhal@gmail.com', 'admin@abumafhal.com', 'abumafhal@gmail.com'];

    const fetchUserRole = async (userId: string, userEmail?: string | null) => {
        try {
            const lowerEmail = userEmail ? userEmail.toLowerCase().trim() : '';
            const isAdminEmail = lowerEmail && (KNOWN_ADMIN_EMAILS.includes(lowerEmail) || lowerEmail.includes('admin'));

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
            const profileEmail = data?.email || userEmail;
            const checkEmail = profileEmail ? profileEmail.toLowerCase().trim() : '';
            const isConfirmedAdmin = checkEmail && (KNOWN_ADMIN_EMAILS.includes(checkEmail) || checkEmail.includes('admin'));

            if (isConfirmedAdmin) {
                roleToSet = 'admin';
                if (data && data.role !== 'admin') {
                    try { await supabase.from('profiles').update({ role: 'admin' }).eq('id', userId); } catch (err) {}
                }
            } else if (!roleToSet) {
                roleToSet = 'user';
            }

            setUserRole(roleToSet);
            await AsyncStorage.setItem(`user_role_${userId}`, roleToSet);
        } catch (e) {
            console.log('Error fetching role in layout:', e);
        }
    };

    useEffect(() => {
        // Safety timeout: Ensure app layout initializes within 1.5s even if network is slow/offline
        const bootTimer = setTimeout(() => {
            setAuthChecked(true);
            setInitialized(true);
        }, 1500);

        supabase.auth.getSession().then(async ({ data: { session }, error }) => {
            clearTimeout(bootTimer);
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
            clearTimeout(bootTimer);
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

        return () => {
            clearTimeout(bootTimer);
            subscription.unsubscribe();
        };
    }, []);

    useEffect(() => {
        if (loaded && initialized && authChecked) {
            SplashScreen.hideAsync().catch(() => {});
        }
    }, [loaded, initialized, authChecked]);

    useEffect(() => {
        if (!initialized || !loaded || !authChecked) return;

        const currentScreen = segments[segments.length - 1] || 'index';
        const isAuthGroup = segments.includes('(auth)');
        const isManagementGroup = segments.includes('manage') || segments[0] === 'manage' || segments[0] === '(manage)';
        const isAppGroup = segments.includes('(app)') || segments.some(s => ['dashboard', 'profile', 'wallet', 'history'].includes(s));

        const publicScreens = ['index', 'onboarding', 'privacy', 'terms'];
        const isPublicScreen = publicScreens.includes(currentScreen);

        if (session) {
            if (isAuthGroup) {
                const allowedAuthScreens = ['otp', 'pin-setup', 'pin'];
                if (userRole && !allowedAuthScreens.includes(currentScreen)) {
                    router.replace('/(app)/dashboard');
                }
            } else if (isManagementGroup) {
                const userEmail = session.user.email?.toLowerCase() || '';
                const isAdminEmail = userEmail.includes('admin') || userEmail.endsWith('@abumafhal.com') || userEmail.endsWith('@abumafhal.com.ng') || userEmail === 'sale.abumafhal@gmail.com' || userEmail === 'abumafhal@gmail.com';
                if (userRole && !['admin', 'super_admin'].includes(userRole) && !isAdminEmail) {
                    router.replace('/(app)/dashboard');
                }
            } else if (currentScreen === 'index' || currentScreen === 'onboarding') {
                AsyncStorage.getItem(`user_pin_${session.user.id}`).then((savedPin) => {
                    if (savedPin) {
                        router.replace('/(auth)/pin');
                    } else {
                        router.replace('/(app)/dashboard');
                    }
                }).catch(() => {
                    router.replace('/(app)/dashboard');
                });
            }
        } else {
            // Check if active session marker exists before forcing redirect to landing page on refresh
            AsyncStorage.getItem('has_active_session').then((activeMarker) => {
                if (!activeMarker && !isPublicScreen && !isAuthGroup) {
                    router.replace('/');
                }
            }).catch(() => {
                if (!isPublicScreen && !isAuthGroup) {
                    router.replace('/');
                }
            });
        }
    }, [session, userRole, initialized, segments, loaded, authChecked]);

    if (!loaded || !initialized) {
        return null;
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
                    <Stack.Screen name="manage" />
                    <Stack.Screen name="(auth)" />
                    <Stack.Screen name="(app)" />
                </Stack>
                <StatusBar style="auto" />
            </ThemeProvider>
        </SafeAreaProvider>
    );
}
