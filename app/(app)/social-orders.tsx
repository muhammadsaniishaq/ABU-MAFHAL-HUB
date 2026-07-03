import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../services/supabase';

// Theme Configuration matching the rest of the app
const T = {
    primary: '#ec4899', 
    navy: '#0d1b3e', // Main app navy
    white: '#ffffff',
    gray: '#f4f6fb', // Main app background
    text: '#334155',
    textLight: '#64748b',
    border: '#e2e8f0',
    gold: '#f5a623',
};

interface OrderTx {
    id: string;
    amount: number;
    reference: string;
    status: string;
    created_at: string;
    description: string;
}

export default function SocialOrdersScreen() {
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState<OrderTx[]>([]);
    const insets = useSafeAreaInsets();

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_id', session.user.id)
                .like('reference', 'SMM-%')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setOrders(data || []);
        } catch (error: any) {
            console.error(error);
            Alert.alert("Error", "Failed to load orders");
        } finally {
            setLoading(false);
        }
    };

    const checkStatus = async (reference: string) => {
        try {
            const parts = reference.split('-');
            if (parts.length < 2) return;
            const orderId = parts[1];

            const { data, error } = await supabase.functions.invoke('smm-api', {
                body: { action: 'status', orderId }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            Alert.alert(
                "Live Status",
                `Status: ${data.status}\nRemains: ${data.remains}\nCharge: ${data.charge}`
            );
        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to check status");
        }
    };

    return (
        <View style={s.container}>
            <Stack.Screen options={{ headerShown: false }} />
            
            <View style={[s.headerContainer, { paddingTop: insets.top + 8 }]}>
                <View style={s.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
                        <Ionicons name="arrow-back" size={22} color={T.white} />
                    </TouchableOpacity>
                    <Text style={s.headerTitle}>Order History</Text>
                    <View style={{ width: 40 }} />
                </View>
            </View>

            {loading ? (
                <View style={s.center}>
                    <ActivityIndicator size="large" color={T.navy} />
                </View>
            ) : orders.length === 0 ? (
                <View style={s.center}>
                    <View style={s.emptyIconBg}>
                        <Ionicons name="receipt-outline" size={48} color={T.textLight} />
                    </View>
                    <Text style={s.emptyTxt}>No active orders yet.</Text>
                </View>
            ) : (
                <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
                    {orders.map((order) => (
                        <View key={order.id} style={s.card}>
                            <View style={s.cardHeader}>
                                <Text style={s.cardTitle} numberOfLines={2}>{order.description}</Text>
                                <Text style={s.cardAmount}>₦{order.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                            </View>
                            
                            <View style={s.cardRow}>
                                <View style={s.dateBox}>
                                    <Ionicons name="calendar-outline" size={14} color={T.textLight} />
                                    <Text style={s.dateTxt}>{new Date(order.created_at).toLocaleDateString()} {new Date(order.created_at).toLocaleTimeString()}</Text>
                                </View>
                                <View style={[s.badge, { backgroundColor: '#dcfce7' }]}>
                                    <Text style={[s.badgeTxt, { color: '#166534' }]}>{order.status}</Text>
                                </View>
                            </View>

                            <TouchableOpacity 
                                style={s.checkBtn}
                                onPress={() => checkStatus(order.reference)}
                                activeOpacity={0.8}
                            >
                                <Text style={s.checkBtnTxt}>Check Live Status</Text>
                            </TouchableOpacity>
                        </View>
                    ))}
                    <View style={{ height: 40 }} />
                </ScrollView>
            )}
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: T.gray },
    headerContainer: {
        backgroundColor: T.navy,
        paddingHorizontal: 16,
        paddingBottom: 16,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    iconBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: { fontSize: 16, fontWeight: '700', color: T.white },
    content: { padding: 16 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyIconBg: { backgroundColor: T.white, padding: 20, borderRadius: 20, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6 },
    emptyTxt: { fontSize: 13, color: T.textLight, fontWeight: '600' },
    
    card: {
        backgroundColor: T.white,
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        shadowColor: '#0d1b3e', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
    cardTitle: { fontSize: 13, fontWeight: '600', color: T.text, flex: 1, marginRight: 10, lineHeight: 18 },
    cardAmount: { fontSize: 14, fontWeight: '800', color: T.navy },
    cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    dateBox: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    dateTxt: { fontSize: 11, color: T.textLight, fontWeight: '500' },
    badge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
    badgeTxt: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
    checkBtn: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: T.border,
        paddingVertical: 10,
        borderRadius: 8,
    },
    checkBtnTxt: { fontSize: 12, fontWeight: '600', color: T.navy }
});
