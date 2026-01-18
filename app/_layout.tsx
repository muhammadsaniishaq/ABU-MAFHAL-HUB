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
            if (data) setUserRole(data.role);
        } catch (e) {
            console.error('Error fetching role in layout:', e);
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
        const isManagementGroup = segments.includes('management-v4-core') || segments[0] === 'management-v4-core';
        const isAppGroup = segments.includes('(app)') || segments.some(s => ['dashboard', 'profile', 'wallet', 'history'].includes(s));

        if (session) {
            if (isAuthGroup) {
                // If logged in and in auth group, redirect to proper home
                if (userRole) {
                    router.replace(userRole === 'admin' || userRole === 'super_admin' ? '/management-v4-core' : '/(app)/dashboard');
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
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="management-v4-core" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(app)" />
            </Stack>
            <StatusBar style="auto" />
        </ThemeProvider>
    );
}
