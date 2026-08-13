import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../services/supabase';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function NotFoundScreen() {
    const router = useRouter();

    useEffect(() => {
        let isMounted = true;

        const resolveRoute = async () => {
            try {
                // 1. Instant check via cached active session marker & cached role
                const activeMarker = await AsyncStorage.getItem('has_active_session');
                
                if (activeMarker === 'true') {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session?.user) {
                        const cachedRole = await AsyncStorage.getItem(`user_role_${session.user.id}`);
                        if (cachedRole === 'admin' || cachedRole === 'super_admin') {
                            if (isMounted) router.replace('/manage/dashboard' as any);
                        } else {
                            if (isMounted) router.replace('/(app)/dashboard');
                        }
                    } else {
                        if (isMounted) router.replace('/(app)/dashboard');
                    }
                    return;
                }

                // 2. Fetch session from Supabase if no cache marker
                const { data: { session } } = await supabase.auth.getSession();
                
                if (session && session.user) {
                    await AsyncStorage.setItem('has_active_session', 'true');
                    const cachedRole = await AsyncStorage.getItem(`user_role_${session.user.id}`);
                    
                    if (cachedRole === 'admin' || cachedRole === 'super_admin') {
                        if (isMounted) router.replace('/manage/dashboard' as any);
                    } else {
                        if (isMounted) router.replace('/(app)/dashboard');
                    }

                    // Async background role check (non-blocking)
                    (async () => {
                        try {
                            const { data: profile } = await supabase
                                .from('profiles')
                                .select('role')
                                .eq('id', session.user.id)
                                .maybeSingle();
                            if (profile?.role) {
                                await AsyncStorage.setItem(`user_role_${session.user.id}`, profile.role);
                            }
                        } catch (err) {}
                    })();
                } else {
                    if (isMounted) router.replace('/(auth)/login');
                }
            } catch (e) {
                console.error("Instant route resolve error:", e);
                if (isMounted) router.replace('/(auth)/login');
            }
        };

        resolveRoute();

        return () => {
            isMounted = false;
        };
    }, []);

    // Flexible, instant transition without any stuck loading text or spinners
    return (
        <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
            <StatusBar style="light" />
        </View>
    );
}

