import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';
import { View, ActivityIndicator, LogBox } from 'react-native';
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
        supabase.auth.getSession().then(async ({ data: { session }, error }) => {
            if (error) {
                console.log("Session init error returned:", error.message);
                if (error.message?.includes('Refresh Token') || error.message?.includes('refresh_token') || error.message?.includes('Refresh token')) {
                    await forceSignOut();
                }
                setSession(null);
            } else {
                setSession(session);
                if (session?.user) {
                    // Restore role from local cache immediately
                    const cached = await AsyncStorage.getItem(`user_role_${session.user.id}`);
                    if (cached) setUserRole(cached);
                    await fetchUserRole(session.user.id, session.user.email);
                }
            }
            setInitialized(true);
        }).catch(async (error) => {
            console.log("Session init error thrown:", error?.message || error);
            // If refresh token is invalid, clear session
            if (error?.message?.includes('Refresh Token') || error?.message?.includes('refresh_token') || error?.message?.includes('Refresh token')) {
                await forceSignOut();
                setSession(null);
            }
            setInitialized(true);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            setSession(session);
            if (session?.user) {
                const cached = await AsyncStorage.getItem(`user_role_${session.user.id}`);
                if (cached) setUserRole(cached);
                fetchUserRole(session.user.id, session.user.email);
            } else {
                setUserRole(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (loaded && initialized) {
            SplashScreen.hideAsync();
        }
    }, [loaded, initialized]);

    useEffect(() => {
        if (!initialized || !loaded) return;

        const currentScreen = segments[segments.length - 1] || 'index';
        const isAuthGroup = segments.includes('(auth)');
        const isManagementGroup = segments.includes('manage') || segments[0] === 'manage' || segments[0] === '(manage)';
        const isAppGroup = segments.includes('(app)') || segments.some(s => ['dashboard', 'profile', 'wallet', 'history'].includes(s));

        const publicScreens = ['index', 'onboarding', 'privacy', 'terms'];
        const isPublicScreen = publicScreens.includes(currentScreen);

        if (session) {
            if (isAuthGroup) {
                const allowedAuthScreens = ['otp', 'pin-setup'];
                if (userRole && !allowedAuthScreens.includes(currentScreen)) {
                    router.replace('/(app)/dashboard');
                }
            } else if (isManagementGroup) {
                if (userRole && !['admin', 'super_admin'].includes(userRole)) {
                    router.replace('/(app)/dashboard');
                }
            } else if (currentScreen === 'index' || currentScreen === 'onboarding') {
                // If on landing page (/) or onboarding and authenticated, go to dashboard immediately
                router.replace('/(app)/dashboard');
            }
        } else {
            if (!isPublicScreen && !isAuthGroup) {
                router.replace('/');
            }
        }
    }, [session, userRole, initialized, segments, loaded]);

    if (!loaded || !initialized || settingsLoading) {
        // Return nothing instead of a spinner, keep the native splash screen visible
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
