import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../services/supabase';
import { StatusBar } from 'expo-status-bar';

// Executive Light Navy & Gold Tokens
const L = {
    bg: '#0F172A',
    gold: '#F5A623',
    goldBg: 'rgba(254, 243, 199, 0.15)',
    textLight: '#F8FAFC',
    textMuted: '#94A3B8'
};

export default function NotFoundScreen() {
    const router = useRouter();

    useEffect(() => {
        const resolveRoute = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                
                if (session && session.user) {
                    // Check user role for admin vs regular user
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('role')
                        .eq('id', session.user.id)
                        .maybeSingle();

                    if (profile?.role === 'admin' || profile?.role === 'super_admin') {
                        router.replace('/manage/dashboard' as any);
                    } else {
                        router.replace('/(app)/dashboard');
                    }
                } else {
                    router.replace('/(auth)/login');
                }
            } catch (e) {
                console.error("Not found route handler error:", e);
                router.replace('/(auth)/login');
            }
        };

        const timer = setTimeout(resolveRoute, 300);
        return () => clearTimeout(timer);
    }, []);

    return (
        <View style={{ flex: 1, backgroundColor: L.bg, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <StatusBar style="light" />
            <ActivityIndicator size="large" color={L.gold} />
            <Text style={{ color: L.gold, fontSize: 13, fontWeight: '900', marginTop: 14, letterSpacing: -0.2 }}>
                Redirecting To Your Dashboard...
            </Text>
            <Text style={{ color: L.textMuted, fontSize: 10, marginTop: 4, textAlign: 'center' }}>
                Securing your session and loading workspace...
            </Text>
        </View>
    );
}
