import { Stack } from 'expo-router';
import { View, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function AdminLayout() {
    const router = useRouter();
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const checkAdminAuth = async () => {
            try {
                // 1. Fetch current authenticated session from Supabase
                const { data: { session } } = await supabase.auth.getSession();
                let user = session?.user;

                if (!user) {
                    const { data: { user: fetchedUser } } = await supabase.auth.getUser();
                    user = fetchedUser || undefined;
                }

                if (!user) {
                    if (isMounted) {
                        setIsAuthorized(false);
                        setLoading(false);
                        router.replace('/(auth)/login');
                    }
                    return;
                }

                const userEmail = user.email?.toLowerCase() || '';
                const isKnownAdminEmail = userEmail === 'sale.abumafhal@gmail.com' || userEmail === 'abumafhal@gmail.com' || userEmail.endsWith('@abumafhal.com') || userEmail.endsWith('@abumafhal.com.ng');

                // 2. Fetch verified role directly from profiles table
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role, email')
                    .eq('id', user.id)
                    .maybeSingle();

                const role = profile?.role || user.user_metadata?.role || (isKnownAdminEmail ? 'admin' : 'user');
                const hasAdminPrivileges = ['admin', 'super_admin'].includes(role) || isKnownAdminEmail;

                if (hasAdminPrivileges) {
                    await AsyncStorage.setItem(`user_role_${user.id}`, role);
                    await AsyncStorage.setItem('has_active_session', 'true');
                    await AsyncStorage.setItem('last_security_verification_time', Date.now().toString());
                    if (isMounted) {
                        setIsAuthorized(true);
                        setLoading(false);
                    }
                } else {
                    console.warn(`[Security Guard] Unauthorized access attempt to /manage by user: ${user.id} (${user.email})`);
                    if (isMounted) {
                        setIsAuthorized(false);
                        setLoading(false);
                        router.replace('/(app)/dashboard');
                    }
                }
            } catch (e) {
                console.error("[Security Guard] Admin verification error:", e);
                if (isMounted) {
                    setIsAuthorized(false);
                    setLoading(false);
                    router.replace('/(app)/dashboard');
                }
            }
        };

        checkAdminAuth();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (!session?.user && isMounted) {
                setIsAuthorized(false);
                setLoading(false);
                router.replace('/(auth)/login');
            }
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    if (loading) {
        return (
            <View style={{ flex: 1, backgroundColor: '#060B19', alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="large" color="#FFD700" />
                <Text style={{ color: '#FFD700', marginTop: 12, fontWeight: '700', fontSize: 12, letterSpacing: 0.5 }}>VERIFYING CREDENTIALS...</Text>
            </View>
        );
    }

    if (!isAuthorized) {
        return (
            <View style={{ flex: 1, backgroundColor: '#060B19', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                <Ionicons name="shield-outline" size={48} color="#EF4444" />
                <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '900', marginTop: 16 }}>ACCESS RESTRICTED</Text>
                <Text style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', marginTop: 8, marginBottom: 20 }}>
                    You do not have administrative clearance to access the management vault.
                </Text>
                <TouchableOpacity 
                    onPress={() => router.replace('/(app)/dashboard')}
                    style={{ backgroundColor: '#FFD700', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 }}
                >
                    <Text style={{ color: '#0F172A', fontWeight: '900', fontSize: 12 }}>RETURN TO DASHBOARD</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <Stack
            screenOptions={{
                headerStyle: {
                    backgroundColor: '#0F172A',
                },
                headerTintColor: '#fff',
                headerTitleStyle: {
                    fontWeight: 'bold',
                },
                headerRight: () => (
                    <TouchableOpacity onPress={() => router.replace('/(app)/dashboard')} style={{ marginRight: 16 }}>
                        <Ionicons name="exit-outline" size={24} color="#FFD700" />
                    </TouchableOpacity>
                ),
            }}
        >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="api" options={{ title: 'API Vault & Master Control' }} />
            <Stack.Screen name="secrets" options={{ title: 'System Secrets' }} />
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
            <Stack.Screen name="rates" options={{ title: 'Market Maker' }} />
            <Stack.Screen name="risk" options={{ title: 'Risk Control' }} />
            <Stack.Screen name="localization" options={{ title: 'Global Logic' }} />
            <Stack.Screen name="stores" options={{ title: 'App Release' }} />
            <Stack.Screen name="infrastructure" options={{ title: 'Cloud Grid' }} />
            <Stack.Screen name="forensics" options={{ title: 'Forensics Unit' }} />
            <Stack.Screen name="panic" options={{ title: 'PANIC ROOM' }} />
            <Stack.Screen name="academy" options={{ title: 'Admin Academy' }} />
            <Stack.Screen name="legal" options={{ title: 'Legal Vault' }} />
            <Stack.Screen name="voice" options={{ title: 'Voice OS' }} />
            <Stack.Screen name="cards" options={{ title: 'Card Issuer' }} />
            <Stack.Screen name="lending" options={{ title: 'Lending HQ' }} />
            <Stack.Screen name="wealth" options={{ title: 'Wealth & Assets' }} />
        </Stack>
    );
}
