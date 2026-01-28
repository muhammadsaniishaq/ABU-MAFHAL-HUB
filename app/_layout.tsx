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


// Configure Reanimated Logger to be less chatty about render phase value access
configureReanimatedLogger({
    strict: false,
    level: ReanimatedLogLevel.warn,
});

// Suppress other noisy warnings
LogBox.ignoreLogs([
    'SafeAreaView has been deprecated',
    '[Reanimated] Reading from `value`',
]);
import { supabase, forceSignOut } from '../services/supabase';
import { Session } from '@supabase/supabase-js';

import { useColorScheme } from '@/hooks/useColorScheme';
import '../global.css';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync().catch((e) => console.warn("SplashScreen preventAutoHideAsync failed:", e));

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

    const fetchUserRole = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', userId)
                .single();
            
            if (error) {
                // If unauthorized or bad request, session is likely invalid
                const err = error as any;
                if (err.code === 'PGRST301' || err.message?.includes('JWT') || err.status === 401 || err.status === 400 || err.code === '401' || err.code === '400') {
                    console.log("Forcing logout due to session error...");
                    await forceSignOut();
                    setSession(null);
                } else {
                    // Downgrade to warn for other errors (likely network)
                    console.warn("Error fetching role (likely network/offline):", error.message);
                }
                return;
            }

            if (data) setUserRole(data.role);
        } catch (e) {
            console.warn('Error fetching role in layout:', e);
        }
    };

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session?.user) fetchUserRole(session.user.id);
            setInitialized(true);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session?.user) fetchUserRole(session.user.id);
            else setUserRole(null);
        });

        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (loaded) {
            SplashScreen.hideAsync();
        }
    }, [loaded]);

    useEffect(() => {
        if (!initialized || !loaded) return;

        const isAuthGroup = segments.includes('(auth)');
        const isManagementGroup = segments.includes('manage') || segments[0] === 'manage' || segments[0] === '(manage)';
        const isAppGroup = segments.includes('(app)') || segments.some(s => ['dashboard', 'profile', 'wallet', 'history'].includes(s));

        if (session) {
            if (isAuthGroup) {
                // Determine current screen
                const currentScreen = segments[segments.length - 1];
                const allowedAuthScreens = ['otp', 'pin-setup'];

                // Only redirect if NOT on an allowed auth screen (like OTP or Setup)
                if (userRole && !allowedAuthScreens.includes(currentScreen)) {
                    router.replace(['admin', 'super_admin'].includes(userRole) ? '/manage' : '/(app)/dashboard');
                }
            } else if (isManagementGroup) {
                // Only allow admin/super_admin to management console
                if (userRole && !['admin', 'super_admin'].includes(userRole)) {
                    router.replace('/(app)/dashboard');
                }
            }
        } else {
            // Guest User
            if (isManagementGroup || isAppGroup) {
                // Protect non-public routes
                router.replace('/');
            }
        }
    }, [session, userRole, initialized, segments, loaded]);

    if (!loaded || !initialized) {
        return (
            <View className="flex-1 items-center justify-center bg-slate-950">
                <ActivityIndicator size="large" color="#6366F1" />
            </View>
        );
    }

    return (
        <SafeAreaProvider>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="manage" />
                    <Stack.Screen name="(auth)" />
                    <Stack.Screen name="(app)" />
                    <Stack.Screen name="education" options={{ headerShown: false }} />
                    <Stack.Screen name="crypto" options={{ headerShown: false }} />
                </Stack>
                <StatusBar style="auto" />
            </ThemeProvider>
        </SafeAreaProvider>
    );
}
