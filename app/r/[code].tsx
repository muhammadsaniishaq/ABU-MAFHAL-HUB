import React, { useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

export default function ShortReferralCodeRedirect() {
    const router = useRouter();
    const { code } = useLocalSearchParams<{ code?: string }>();

    useEffect(() => {
        const refCode = code ? String(code).trim() : '';
        if (refCode) {
            router.replace(`/(auth)/signup?ref=${encodeURIComponent(refCode)}`);
        } else {
            router.replace(`/(auth)/signup`);
        }
    }, [code]);

    return (
        <LinearGradient colors={['#020617', '#0F172A', '#020617']} style={s.container}>
            <ActivityIndicator size="large" color="#F59E0B" />
            <Text style={s.text}>Redirecting to Registration...</Text>
        </LinearGradient>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        color: '#FFFFFF',
        marginTop: 12,
        fontSize: 13,
        fontWeight: '700',
    },
});
