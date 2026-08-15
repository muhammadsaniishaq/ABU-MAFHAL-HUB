import React, { useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

export default function RegisterRedirect() {
    const router = useRouter();
    const { ref, referral, code } = useLocalSearchParams<{ ref?: string; referral?: string; code?: string }>();

    useEffect(() => {
        const refCode = ref || referral || code || '';
        if (refCode) {
            router.replace(`/(auth)/signup?ref=${encodeURIComponent(refCode.trim())}`);
        } else {
            router.replace(`/(auth)/signup`);
        }
    }, [ref, referral, code]);

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
