import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function CinemaAuditRedirect() {
    const router = useRouter();

    useEffect(() => {
        const timer = setTimeout(() => {
            router.replace('/manage/logs');
        }, 600);
        return () => clearTimeout(timer);
    }, []);

    return (
        <View style={s.container}>
            <Stack.Screen
                options={{
                    title: 'Audit & Telemetry Center',
                    headerStyle: { backgroundColor: '#040817' },
                    headerTintColor: '#FFFFFF',
                }}
            />
            <LinearGradient colors={['#070D1E', '#0B132B']} style={s.card}>
                <View style={s.iconCircle}>
                    <Ionicons name="shield-checkmark" size={38} color="#F5A623" />
                </View>
                <Text style={s.title}>Audit Logs Centralized</Text>
                <Text style={s.sub}>
                    Audit logs, incident tracking, and governance telemetry have been unified into the Enterprise Audit Center.
                </Text>
                <ActivityIndicator size="small" color="#F5A623" style={{ marginVertical: 14 }} />
                <TouchableOpacity
                    onPress={() => router.replace('/manage/logs')}
                    style={s.btn}
                    activeOpacity={0.8}
                >
                    <Ionicons name="arrow-forward-circle" size={16} color="#070D1E" />
                    <Text style={s.btnText}>Open Audit Center ↗</Text>
                </TouchableOpacity>
            </LinearGradient>
        </View>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#040817',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    card: {
        width: '100%',
        maxWidth: 440,
        borderRadius: 20,
        padding: 28,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#1C2C5B',
    },
    iconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: 'rgba(245, 166, 35, 0.12)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(245, 166, 35, 0.3)',
    },
    title: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '900',
        marginBottom: 8,
        textAlign: 'center',
    },
    sub: {
        color: '#94A3B8',
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 8,
    },
    btn: {
        backgroundColor: '#F5A623',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    btnText: {
        color: '#070D1E',
        fontSize: 13,
        fontWeight: '800',
    },
});
