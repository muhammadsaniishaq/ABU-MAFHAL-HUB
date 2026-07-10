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
    const [liveStatusMap, setLiveStatusMap] = useState<Record<string, any>>({});
    const [checkingMap, setCheckingMap] = useState<Record<string, boolean>>({});
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
            const fetchedOrders = data || [];
            setOrders(fetchedOrders);

            // Automatically fetch live statuses for all orders
            fetchedOrders.forEach(order => {
                checkStatus(order.id, order.reference);
            });
        } catch (error: any) {
            console.error(error);
            Alert.alert("Error", "Failed to load orders");
        } finally {
            setLoading(false);
        }
    };

    const checkStatus = async (orderIdKey: string, reference: string) => {
        try {
            setCheckingMap(prev => ({...prev, [orderIdKey]: true}));
            const parts = reference.split('-');
            if (parts.length < 2) return;
            const orderId = parts[1];

            if (orderId === 'undefined' || !orderId) {
                throw new Error("This order encountered a processing issue and has no valid ID.");
            }

            const { data, error } = await supabase.functions.invoke('smm-api', {
                body: { action: 'status', orderId }
            });

            if (error) throw error;
            if (data?.error) {
                if (data.error.toLowerCase().includes('invalid') || data.error.toLowerCase().includes('incorrect')) {
                    throw new Error("Order not found on the server. It may have been cancelled or the API key changed.");
                }
                throw new Error(data.error);
            }

            setLiveStatusMap(prev => ({
                ...prev,
                [orderIdKey]: data
            }));

        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to check status");
        } finally {
            setCheckingMap(prev => ({...prev, [orderIdKey]: false}));
        }
    };

    const getStatusStyle = (statusStr: string) => {
        const s = statusStr?.toLowerCase() || '';
        if (s === 'completed' || s === 'success' || s === 'successful') return { bg: '#dcfce7', txt: '#166534' };
        if (s === 'pending') return { bg: '#fef3c7', txt: '#92400e' };
        if (s === 'in progress' || s === 'processing') return { bg: '#dbeafe', txt: '#1e40af' };
        if (s === 'canceled' || s === 'partial' || s === 'fail') return { bg: '#fee2e2', txt: '#991b1b' };
        return { bg: '#f1f5f9', txt: '#475569' };
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
                    {orders.map((order) => {
                        const liveData = liveStatusMap[order.id];
                        const displayStatus = liveData ? liveData.status : "Placed";
                        const stStyle = getStatusStyle(displayStatus);

                        return (
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
                                    <View style={[s.badge, { backgroundColor: stStyle.bg }]}>
                                        <Text style={[s.badgeTxt, { color: stStyle.txt }]}>{displayStatus}</Text>
                                    </View>
                                </View>

                                {liveData && liveData.remains !== undefined && (
                                    <View style={{ flexDirection: 'row', marginBottom: 10 }}>
                                        <Text style={{ fontSize: 11, color: T.textLight, fontWeight: '600' }}>Remains: </Text>
                                        <Text style={{ fontSize: 11, color: T.text, fontWeight: '700' }}>{liveData.remains}</Text>
                                    </View>
                                )}

                                <TouchableOpacity 
                                    style={s.checkBtn}
                                    onPress={() => checkStatus(order.id, order.reference)}
                                    activeOpacity={0.8}
                                    disabled={checkingMap[order.id]}
                                >
                                    {checkingMap[order.id] ? (
                                        <ActivityIndicator size="small" color={T.navy} />
                                    ) : (
                                        <Text style={s.checkBtnTxt}>Check Live Status</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        );
                    })}
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
