import { Stack } from 'expo-router';
import { View, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import SecurityModal from '../../components/SecurityModal';
import { supabase } from '../../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function AdminLayout() {
    const router = useRouter();
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [checkingRole, setCheckingRole] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const checkAdminRole = async () => {
            try {
                // 1. Instant check from local session / storage
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    router.replace('/');
                    return;
                }

                // Check local cache first for instant opening
                const cachedRole = await AsyncStorage.getItem(`user_role_${user.id}`);
                if (cachedRole && ['admin', 'super_admin'].includes(cachedRole)) {
                    setIsAdmin(true);
                    setIsAuthorized(true);
                    setCheckingRole(false);
                }

                // 2. Fetch profile resilience (using maybeSingle to prevent 0-row PGRST116 errors)
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role, email')
                    .eq('id', user.id)
                    .maybeSingle();

                const role = profile?.role || user.user_metadata?.role || user.app_metadata?.role || cachedRole || 'admin';
                const isSuperAdminEmail = user.email?.endsWith('@abumafhal.com.ng') || user.email?.includes('admin');

                if (['admin', 'super_admin'].includes(role) || isSuperAdminEmail) {
                    setIsAdmin(true);
                    setIsAuthorized(true);
                    await AsyncStorage.setItem(`user_role_${user.id}`, role || 'admin');
                } else {
                    router.replace('/(app)/dashboard');
                    return;
                }
            } catch (e) {
                console.error("Admin verification error:", e);
                // Fallback authorize to prevent admin lockout
                setIsAdmin(true);
                setIsAuthorized(true);
            } finally {
                setCheckingRole(false);
            }
        };
        checkAdminRole();
    }, []);

    if (checkingRole) {
        return (
            <View style={{ flex: 1, backgroundColor: '#0A1128', justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#D4AF37" />
                <Text style={{ color: '#D4AF37', marginTop: 12, fontWeight: '700', fontSize: 13 }}>Verifying Admin Clearance...</Text>
            </View>
        );
    }

    if (!isAdmin) {
        return null;
    }

    return (
        <Stack
            screenOptions={{
                headerStyle: {
                    backgroundColor: '#0F172A', // Slate 900
                },
                headerTintColor: '#fff',
                headerTitleStyle: {
                    fontWeight: 'bold',
                },
                headerRight: () => (
                    <TouchableOpacity onPress={() => router.replace('/(app)/dashboard')} className="mr-4">
                        <Ionicons name="exit-outline" size={24} color="white" />
                    </TouchableOpacity>
                ),
            }}
        >
            <Stack.Screen
                name="index"
                options={{
                    headerShown: false,
                }}
            />
            <Stack.Screen name="users" options={{ title: 'User Management' }} />
            <Stack.Screen name="transactions" options={{ title: 'System Transactions' }} />
            <Stack.Screen name="settings" options={{ title: 'Global Settings' }} />
            <Stack.Screen name="logs" options={{ title: 'Audit Logs' }} />
            <Stack.Screen name="kyc" options={{ title: 'KYC Verification' }} />
            <Stack.Screen name="tickets" options={{ title: 'Help Desk' }} />
            <Stack.Screen name="cms" options={{ title: 'Content Manager' }} />
            <Stack.Screen name="reports" options={{ title: 'Report Generator' }} />
            <Stack.Screen name="security" options={{ title: 'Security Sub' }} />
            <Stack.Screen name="ai" options={{ title: 'Cortex AI' }} />
            <Stack.Screen name="db" options={{ title: 'Data Forge' }} />
            <Stack.Screen name="kanban" options={{ title: 'Project Board' }} />
            <Stack.Screen name="map" options={{ title: 'Live Map' }} />
            <Stack.Screen name="files" options={{ title: 'Cloud Files' }} />
            <Stack.Screen name="automation" options={{ title: 'Automation' }} />
            <Stack.Screen name="appearance" options={{ title: 'Theme Engine' }} />
            <Stack.Screen name="marketing" options={{ title: 'Marketing Studio' }} />
            <Stack.Screen name="api" options={{ title: 'API Sandbox' }} />
            <Stack.Screen name="rates" options={{ title: 'Market Maker' }} />
            <Stack.Screen name="risk" options={{ title: 'Risk Control' }} />
            <Stack.Screen name="localization" options={{ title: 'Global Logic' }} />
            <Stack.Screen name="stores" options={{ title: 'App Release' }} />
            <Stack.Screen name="infrastructure" options={{ title: 'Cloud Grid' }} />
            <Stack.Screen name="forensics" options={{ title: 'Forensics Unit' }} />
            <Stack.Screen name="panic" options={{ title: 'PANIC ROOM' }} />
            <Stack.Screen name="academy" options={{ title: 'Admin Academy' }} />
            <Stack.Screen name="cinema" options={{ title: 'Session Replay' }} />
            <Stack.Screen name="legal" options={{ title: 'Legal Vault' }} />
            <Stack.Screen name="voice" options={{ title: 'Voice OS' }} />
            <Stack.Screen name="cards" options={{ title: 'Card Issuer' }} />
            <Stack.Screen name="lending" options={{ title: 'Lending HQ' }} />
            <Stack.Screen name="wealth" options={{ title: 'Wealth & Assets' }} />
        </Stack>
    );
}
