import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Platform, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase, processOAuthReturn } from '../../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const L = {
    navyDark: '#0B132B',
    navyMid: '#1C2541',
    navyHeader: '#0F172A',
    gold: '#F5A623',
    goldDk: '#D97706',
    goldAmber: '#B45309',
    goldBg: 'rgba(254, 243, 199, 0.75)',
    card: '#FFFFFF',
    textPrimary: '#0F172A',
    textMuted: '#64748B',
    emerald: '#10B981',
};

export default function AuthCallbackScreen() {
    const router = useRouter();
    const [statusText, setStatusText] = useState('Tabbatar da Asusu (Verifying Authentication)...');
    const [appDeepLink, setAppDeepLink] = useState<string | null>(null);
    const [isMobileDevice, setIsMobileDevice] = useState(false);

    useEffect(() => {
        handleOAuthCallback();
    }, []);

    const handleOAuthCallback = async () => {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            try {
                const search = window.location.search || '';
                const hash = window.location.hash || '';
                const fullParams = `${search}${hash}`;
                const targetDeepLink = `abumafhalsub://login${fullParams}`;
                setAppDeepLink(targetDeepLink);

                const ua = (window.navigator?.userAgent || '').toLowerCase();
                const isMobile = /android|iphone|ipad|ipod/.test(ua);
                setIsMobileDevice(isMobile);

                // 1. Process session on web
                const success = await processOAuthReturn();

                if (success) {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session?.user) {
                        await AsyncStorage.setItem('has_active_session', 'true');
                        await AsyncStorage.setItem('app_unlocked', 'true');

                        // Check and record referral for Google signup if pending
                        try {
                            const pendingRef = (await AsyncStorage.getItem('pending_referral_code')) ||
                                (window.localStorage ? window.localStorage.getItem('pending_referral_code') : null);
                            if (pendingRef && pendingRef.trim()) {
                                await supabase.rpc('record_referral', {
                                    referee_user_id: session.user.id,
                                    referral_input: pendingRef.trim()
                                });
                                await AsyncStorage.removeItem('pending_referral_code');
                                if (window.localStorage) window.localStorage.removeItem('pending_referral_code');
                            }
                        } catch (refErr) {
                            console.log('Callback referral record notice:', refErr);
                        }
                    }
                }

                // 2. If opened from a mobile browser, automatically bounce into native app
                if (isMobile) {
                    setStatusText('Ana buɗe Manhajar Abu Mafhal (Opening App)...');
                    // Trigger deep link into the installed Android/iOS app
                    window.location.href = targetDeepLink;

                    // Fallback timer if browser blocks instant redirect
                    setTimeout(() => {
                        setStatusText('Idan app ɗin bai buɗe ba, danna maballin da ke ƙasa.');
                    }, 2000);
                } else {
                    // Desktop browser: route to dashboard or login
                    setStatusText('An tabbatar da asusunka cikin nasara!');
                    setTimeout(() => {
                        router.replace('/dashboard' as any);
                    }, 1200);
                }
            } catch (err: any) {
                console.warn('OAuth Callback error:', err);
                setStatusText('Matsalar tabbatarwa. Da fatan za a sake gwadawa.');
            }
        } else {
            // Native platform
            router.replace('/dashboard' as any);
        }
    };

    const handleManualAppLaunch = () => {
        if (appDeepLink && typeof window !== 'undefined') {
            window.location.href = appDeepLink;
        } else {
            router.replace('/(auth)/login' as any);
        }
    };

    return (
        <View style={s.container}>
            <LinearGradient
                colors={['#010514', '#040d24', '#07153d', '#020617']}
                style={StyleSheet.absoluteFillObject}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.8, y: 1 }}
            />

            <View style={s.card}>
                <View style={s.iconWrapper}>
                    <Ionicons name="shield-checkmark" size={36} color={L.gold} />
                </View>

                <Text style={s.title}>ABU MAFHAL HUB</Text>
                <Text style={s.subtitle}>Google Authentication Bridge</Text>

                <View style={{ marginVertical: 20, alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={L.gold} style={{ marginBottom: 12 }} />
                    <Text style={s.status}>{statusText}</Text>
                </View>

                {isMobileDevice && appDeepLink && (
                    <TouchableOpacity 
                        onPress={handleManualAppLaunch}
                        activeOpacity={0.85}
                        style={s.button}
                    >
                        <Ionicons name="phone-portrait-outline" size={18} color="#0F172A" />
                        <Text style={s.buttonText}>BUƊE A MANHAJAR WAYA (OPEN IN APP)</Text>
                    </TouchableOpacity>
                )}

                <TouchableOpacity 
                    onPress={() => router.replace('/dashboard' as any)}
                    style={{ marginTop: 16, padding: 8 }}
                >
                    <Text style={s.webLink}>Ci gaba a Yanar Gizo (Continue on Web) →</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#020617',
    },
    card: {
        width: '100%',
        maxWidth: 420,
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: '#F5A623',
        padding: 24,
        alignItems: 'center',
        elevation: 10,
    },
    iconWrapper: {
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: 'rgba(245, 166, 35, 0.12)',
        borderWidth: 1.5,
        borderColor: '#F5A623',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    title: {
        fontSize: 18,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 1,
    },
    subtitle: {
        fontSize: 11,
        fontWeight: '700',
        color: '#F5A623',
        textTransform: 'uppercase',
        marginTop: 2,
    },
    status: {
        fontSize: 12,
        fontWeight: '600',
        color: '#CBD5E1',
        textAlign: 'center',
        lineHeight: 18,
    },
    button: {
        backgroundColor: '#F5A623',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 12,
        width: '100%',
        elevation: 4,
        marginTop: 6,
    },
    buttonText: {
        color: '#0F172A',
        fontWeight: '900',
        fontSize: 11,
        letterSpacing: 0.5,
    },
    webLink: {
        color: '#94A3B8',
        fontSize: 11,
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
});
