import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { View, ActivityIndicator } from 'react-native';
import { supabase } from '../services/supabase';
import { Session } from '@supabase/supabase-js';

import { useColorScheme } from '@/hooks/useColorScheme';
import '../global.css';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    const colorScheme = useColorScheme();
    const [loaded] = useFonts({
        // SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    });
    const [session, setSession] = useState<Session | null>(null);
    const [initialized, setInitialized] = useState(false);
    const router = useRouter();
    const segments = useSegments();

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setInitialized(true);
        });

        supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });
    }, []);

    useEffect(() => {
        if (loaded) {
            SplashScreen.hideAsync();
        }
    }, [loaded]);

    useEffect(() => {
        if (!initialized || !loaded) return;

        const segment = segments[0];
        const isAuthGroup = segments.includes('auth') || segments.includes('(auth)');
        const isManagementGroup = segments.includes('management-v4-core');
        const isAppGroup = segments.includes('(app)') || segments.some(s => ['dashboard', 'profile', 'wallet', 'history'].includes(s));
        const isLandingPage = segments.length === 0 || segments[0] === 'index';

        if (session) {
            const role = session.user?.app_metadata?.role;
            const isAdmin = role === 'admin';

            if (isAuthGroup) {
                // If logged in and in auth group, redirect to dashboard or management
                router.replace(isAdmin ? '/management-v4-core' : '/(app)/dashboard');
            } else if (isManagementGroup && !isAdmin) {
                // If standard user tries to access admin, redirect to dashboard
                router.replace('/(app)/dashboard');
            }
        } else {
            // Guest User
            if (isManagementGroup || isAppGroup) {
                // If NOT logged in and trying to access protected areas, redirect back to landing page
                router.replace('/');
            }
        }
    }, [session, initialized, segments, loaded]);

    if (!loaded || !initialized) {
        return (
            <View className="flex-1 items-center justify-center bg-slate-950">
                <ActivityIndicator size="large" color="#6366F1" />
            </View>
        );
    }

    return (
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="management-v4-core" />
                <Stack.Screen name="auth" />
                <Stack.Screen name="(app)" />
                <Stack.Screen name="+not-found" />
            </Stack>
            <StatusBar style="auto" />
        </ThemeProvider>
    );
}
