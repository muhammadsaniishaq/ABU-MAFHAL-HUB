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

        const inAuthGroup = segments[0] === 'auth';

        if (session && inAuthGroup) {
            // If logged in and in auth group, redirect to admin
            router.replace('/admin');
        } else if (!session && !inAuthGroup) {
            // If NOT logged in and NOT in auth group (e.g. root or admin), redirect to login
            router.replace('/auth/login');
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
                <Stack.Screen name="admin" />
                <Stack.Screen name="auth" />
                <Stack.Screen name="+not-found" />
            </Stack>
            <StatusBar style="auto" />
        </ThemeProvider>
    );
}
