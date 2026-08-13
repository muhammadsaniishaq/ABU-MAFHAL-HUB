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
                const { data: { session } } = await supabase.auth.getSession();
                
                if (session?.user) {
                    await AsyncStorage.setItem('has_active_session', 'true');
                    const unlocked = await AsyncStorage.getItem('app_unlocked');

                    if (unlocked === 'true') {
                        const cachedRole = await AsyncStorage.getItem(`user_role_${session.user.id}`);
                        if (cachedRole === 'admin' || cachedRole === 'super_admin') {
                            if (isMounted) router.replace('/manage/dashboard' as any);
                        } else {
                            if (isMounted) router.replace('/dashboard' as any);
                        }
                    } else {
                        if (isMounted) router.replace('/pin' as any);
                    }
                } else {
                    if (isMounted) router.replace('/');
                }
            } catch (e) {
                console.error("Instant route resolve error:", e);
                if (isMounted) router.replace('/');
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

