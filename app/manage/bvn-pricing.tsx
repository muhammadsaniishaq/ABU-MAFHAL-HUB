import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Modal, TextInput, StyleSheet, Platform, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../services/supabase';

// Executive Navy & Gold Design System
const C = {
    bg: '#F8FAFC',
    card: '#FFFFFF',
    cardBorder: 'rgba(212, 175, 55, 0.25)',
    navy: '#0B192C',
    navyMid: '#1E293B',
    navyLight: '#F1F5F9',
    gold: '#D4AF37',
    goldDk: '#B45309',
    goldLight: '#FEF9E7',
    goldBorder: '#FCD34D',
    textMain: '#0F172A',
    textSub: '#475569',
    textMuted: '#94A3B8',
    border: '#E2E8F0',
    success: '#10B981',
    successBg: '#ECFDF5',
    warning: '#F59E0B',
    warningBg: '#FFFBEB',
    danger: '#EF4444',
    dangerBg: '#FEF2F2',
    blue: '#3B82F6',
    blueBg: '#EFF6FF',
    purple: '#8B5CF6',
    purpleBg: '#F5F3FF',
};

const BVN_SERVICES_DEFAULT = [
    {
        id: 'bvn_num_advanced',
        service_category: 'bvn',
        name: 'BVN Verification',
        description: 'Instant full biometric & demographic verification via BVN number',
        cost_price: 150,
        markup_price: 50,
        icon: 'shield-checkmark',
        color: '#10B981',
        bg: '#ECFDF5',
        badge: 'Core'
    },
    {
        id: 'bvn_premium_slip',
        service_category: 'bvn',
        name: 'BVN Premium Slip',
        description: 'Full official high-resolution printable BVN slip generation',
        cost_price: 150,
        markup_price: 100,
        icon: 'star',
        color: '#D4AF37',
        bg: '#FEF9E7',
        badge: 'Popular'
    },
    {
        id: 'bvn_phone_basic',
        service_category: 'bvn',
        name: 'BVN Phone Retrieval',
        description: 'Search and retrieve linked BVN record via registered phone number',
        cost_price: 150,
        markup_price: 150,
        icon: 'search',
        color: '#3B82F6',
        bg: '#EFF6FF',
        badge: 'Search'
    },
    {
        id: 'bvn_card',
        service_category: 'bvn',
        name: 'BVN Plastic Card',
        description: 'Digital ID card formatted layout for plastic/PVC printing',
        cost_price: 200,
        markup_price: 100,
        icon: 'card',
        color: '#8B5CF6',
        bg: '#F5F3FF',
        badge: 'Card'
    },
    {
        id: 'bvn_modification',
        service_category: 'bvn',
        name: 'BVN Modification Request',
        description: 'Submit BVN field change & demographic correction applications',
        cost_price: 1000,
        markup_price: 500,
        icon: 'create',
        color: '#B45309',
        bg: '#FEF9E7',
        badge: 'Mod'
    },
    {
        id: 'bvn_enrollment',
        service_category: 'bvn',
        name: 'BVN Enrollment',
        description: 'New BVN registration and demographic capture portal processing',
        cost_price: 1500,
        markup_price: 500,
        icon: 'person-add',
        color: '#0B192C',
        bg: '#F1F5F9',
        badge: 'Enroll'
    },
    {
        id: 'vnin_to_nibss',
        service_category: 'bvn',
        name: 'VNIN to NIBSS Integration',
        description: 'Direct NIBSS linking of Virtual NIN to customer BVN record',
        cost_price: 500,
        markup_price: 200,
        icon: 'git-compare',
        color: '#6366F1',
        bg: '#EEF2FF',
        badge: 'NIBSS'
    }
];

export default function BVNPricingScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [prices, setPrices] = useState<any[]>([]);
    const [originalPrices, setOriginalPrices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [focusedInput, setFocusedInput] = useState<string | null>(null);

    // Custom Alert State
    const [customAlert, setCustomAlert] = useState<{
        visible: boolean;
        title: string;
        message: string;
        type: 'success' | 'error' | 'info';
    }>({
        visible: false,
        title: '',
        message: '',
        type: 'info'
    });

    const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setCustomAlert({
            visible: true,
            title,
            message,
            type
        });
    };

    const fetchPrices = async () => {
        setLoading(true);
        try {
            // 1. Ensure all default BVN entries exist in service_pricing
            for (const item of BVN_SERVICES_DEFAULT) {
                const { data: existing } = await supabase
                    .from('service_pricing')
                    .select('id')
                    .eq('id', item.id)
                    .maybeSingle();

                if (!existing) {
                    await supabase.from('service_pricing').insert({
                        id: item.id,
                        service_category: 'bvn',
                        name: item.name,
                        cost_price: item.cost_price,
                        markup_price: item.markup_price,
                    });
                }
            }

            // 2. Query from database
            const { data, error } = await supabase
                .from('service_pricing')
                .select('*')
                .eq('service_category', 'bvn');

            if (error) throw error;

            // Merge with local metadata (icons, descriptions, badges)
            const merged = BVN_SERVICES_DEFAULT.map(def => {
                const dbRow = (data || []).find(r => r.id === def.id);
                return {
                    ...def,
                    ...(dbRow || {}),
                    cost_price: dbRow?.cost_price !== undefined ? Number(dbRow.cost_price) : def.cost_price,
                    markup_price: dbRow?.markup_price !== undefined ? Number(dbRow.markup_price) : def.markup_price,
                };
            });

            setPrices(merged);
            setOriginalPrices(JSON.parse(JSON.stringify(merged)));
        } catch (error: any) {
            showAlert('Database Error', error.message || 'Failed to load BVN pricing.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPrices();
    }, []);

    const updateMarkup = (id: string, newMarkup: string) => {
        const val = parseInt(newMarkup, 10);
        if (isNaN(val) && newMarkup !== '') return;

        setPrices(prev => prev.map(p => {
            if (p.id === id) {
                return { ...p, markup_price: newMarkup === '' ? 0 : val };
            }
            return p;
        }));
    };

    const updateCost = (id: string, newCost: string) => {
        const val = parseInt(newCost, 10);
        if (isNaN(val) && newCost !== '') return;

        setPrices(prev => prev.map(p => {
            if (p.id === id) {
                return { ...p, cost_price: newCost === '' ? 0 : val };
            }
            return p;
        }));
    };

    const applyPresetMarkup = (id: string, addition: number) => {
        setPrices(prev => prev.map(p => {
            if (p.id === id) {
                return { ...p, markup_price: Math.max(0, (p.markup_price || 0) + addition) };
            }
            return p;
        }));
    };

    const hasChanges = () => {
        return JSON.stringify(prices) !== JSON.stringify(originalPrices);
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            for (const item of prices) {
                const { error } = await supabase
                    .from('service_pricing')
                    .upsert({
                        id: item.id,
                        service_category: 'bvn',
                        name: item.name,
                        cost_price: Number(item.cost_price || 0),
                        markup_price: Number(item.markup_price || 0),
                        updated_at: new Date().toISOString(),
                    });

                if (error) throw error;
            }

            setOriginalPrices(JSON.parse(JSON.stringify(prices)));
            showAlert('Changes Saved Successfully! ✓', 'All BVN service selling prices and markups have been updated live.', 'success');
        } catch (error: any) {
            showAlert('Save Failed', error.message || 'Could not save pricing changes.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const syncLiveAgentHubPrices = async () => {
        try {
            setSyncing(true);

            // AgentHub official wholesale cost benchmark
            const AGENTHUB_BVN_COSTS: Record<string, number> = {
                'bvn_num_advanced': 150,
                'bvn_premium_slip': 150,
                'bvn_phone_basic': 150,
                'bvn_card': 200,
                'bvn_modification': 1000,
                'bvn_enrollment': 1500,
                'vnin_to_nibss': 500,
            };

            for (const [id, cost] of Object.entries(AGENTHUB_BVN_COSTS)) {
                await supabase
                    .from('service_pricing')
                    .update({ cost_price: cost, updated_at: new Date().toISOString() })
                    .eq('id', id);
            }

            await fetchPrices();
            showAlert('AgentHub Rates Synced ✓', 'BVN cost prices updated to live AgentHub wholesale matrix.', 'success');
        } catch (e: any) {
            showAlert('Sync Warning', e.message || 'Failed to sync live prices.', 'error');
        } finally {
            setSyncing(false);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'BVN Services Pricing',
                    headerStyle: { backgroundColor: C.navy },
                    headerTintColor: '#FFFFFF',
                    headerTitleStyle: { fontWeight: '700', fontSize: 16 },
                    headerLeft: () => (
                        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
                            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
                        </TouchableOpacity>
                    ),
                    headerRight: () => (
                        <TouchableOpacity onPress={syncLiveAgentHubPrices} disabled={syncing} style={{ padding: 4 }}>
                            {syncing ? (
                                <ActivityIndicator size="small" color={C.gold} />
                            ) : (
                                <Ionicons name="cloud-download-outline" size={20} color={C.gold} />
                            )}
                        </TouchableOpacity>
                    ),
                }}
            />

            {/* Header Hero Section */}
            <LinearGradient colors={[C.navy, '#1E293B']} style={styles.heroSection}>
                <View style={styles.heroRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.heroTitle}>BVN Service Pricing Matrix</Text>
                        <Text style={styles.heroSub}>Set cost, profit margin (markup), and live end-user selling fees.</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.syncBtn}
                        onPress={syncLiveAgentHubPrices}
                        disabled={syncing}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="sync" size={14} color="#0B192C" style={{ marginRight: 4 }} />
                        <Text style={styles.syncBtnText}>{syncing ? 'Syncing...' : 'Sync Wholesale'}</Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={C.gold} />
                    <Text style={styles.loadingText}>Loading BVN Pricing Registry...</Text>
                </View>
            ) : (
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                    <ScrollView
                        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
                        showsVerticalScrollIndicator={false}
                    >
                        {prices.map((item) => {
                            const cost = Number(item.cost_price || 0);
                            const markup = Number(item.markup_price || 0);
                            const sellingPrice = cost + markup;
                            const isCostFocused = focusedInput === `cost_${item.id}`;
                            const isMarkupFocused = focusedInput === `markup_${item.id}`;

                            return (
                                <View key={item.id} style={styles.pricingCard}>
                                    {/* Card Header */}
                                    <View style={styles.cardHeader}>
                                        <View style={[styles.iconBox, { backgroundColor: item.bg || C.navyLight }]}>
                                            <Ionicons name={item.icon || 'finger-print'} size={18} color={item.color || C.goldDk} />
                                        </View>
                                        <View style={{ flex: 1, marginLeft: 10 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <Text style={styles.serviceName}>{item.name}</Text>
                                                {item.badge && (
                                                    <View style={[styles.badge, { backgroundColor: item.bg || C.navyLight }]}>
                                                        <Text style={[styles.badgeText, { color: item.color || C.navy }]}>{item.badge}</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={styles.serviceDesc} numberOfLines={2}>{item.description}</Text>
                                        </View>
                                    </View>

                                    {/* Selling Price Display Hero */}
                                    <View style={styles.sellingPriceBox}>
                                        <View>
                                            <Text style={styles.sellingLabel}>CUSTOMER SELLING PRICE</Text>
                                            <Text style={styles.sellingSub}>Cost (₦{cost.toLocaleString()}) + Profit (₦{markup.toLocaleString()})</Text>
                                        </View>
                                        <Text style={styles.sellingAmount}>₦{sellingPrice.toLocaleString()}</Text>
                                    </View>

                                    {/* Edit Inputs Row */}
                                    <View style={styles.inputsRow}>
                                        {/* Cost Price Input */}
                                        <View style={styles.inputCol}>
                                            <Text style={styles.fieldLabel}>Cost Price (₦)</Text>
                                            <TextInput
                                                style={[styles.inputField, isCostFocused && styles.inputFieldFocused]}
                                                keyboardType="numeric"
                                                value={String(cost)}
                                                onChangeText={(val) => updateCost(item.id, val)}
                                                onFocus={() => setFocusedInput(`cost_${item.id}`)}
                                                onBlur={() => setFocusedInput(null)}
                                            />
                                        </View>

                                        {/* Profit / Markup Input */}
                                        <View style={styles.inputCol}>
                                            <Text style={styles.fieldLabel}>Markup Profit (₦)</Text>
                                            <TextInput
                                                style={[styles.inputField, isMarkupFocused && styles.inputFieldFocused, { borderColor: C.goldBorder }]}
                                                keyboardType="numeric"
                                                value={String(markup)}
                                                onChangeText={(val) => updateMarkup(item.id, val)}
                                                onFocus={() => setFocusedInput(`markup_${item.id}`)}
                                                onBlur={() => setFocusedInput(null)}
                                            />
                                        </View>
                                    </View>

                                    {/* Quick Preset Buttons */}
                                    <View style={styles.presetRow}>
                                        <Text style={styles.presetLabel}>Quick Add Margin:</Text>
                                        {[+50, +100, +200].map(addVal => (
                                            <TouchableOpacity
                                                key={addVal}
                                                style={styles.presetBtn}
                                                onPress={() => applyPresetMarkup(item.id, addVal)}
                                            >
                                                <Text style={styles.presetBtnText}>+{addVal}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            );
                        })}
                    </ScrollView>
                </KeyboardAvoidingView>
            )}

            {/* Bottom Save Action Bar */}
            {hasChanges() && (
                <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                    <TouchableOpacity
                        style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                        onPress={handleSave}
                        disabled={saving}
                        activeOpacity={0.85}
                    >
                        {saving ? (
                            <ActivityIndicator size="small" color="#0B192C" />
                        ) : (
                            <>
                                <Ionicons name="checkmark-done" size={18} color="#0B192C" style={{ marginRight: 6 }} />
                                <Text style={styles.saveBtnText}>Save BVN Pricing Changes</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            )}

            {/* Custom Alert Modal */}
            <Modal
                visible={customAlert.visible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setCustomAlert({ ...customAlert, visible: false })}
            >
                <View style={styles.alertOverlay}>
                    <View style={styles.alertCard}>
                        <View style={[
                            styles.alertIconBox,
                            customAlert.type === 'success' ? { backgroundColor: C.successBg } :
                            customAlert.type === 'error' ? { backgroundColor: C.dangerBg } : { backgroundColor: C.blueBg }
                        ]}>
                            <Ionicons
                                name={customAlert.type === 'success' ? 'checkmark-circle' : customAlert.type === 'error' ? 'alert-circle' : 'information-circle'}
                                size={32}
                                color={customAlert.type === 'success' ? C.success : customAlert.type === 'error' ? C.danger : C.blue}
                            />
                        </View>
                        <Text style={styles.alertTitle}>{customAlert.title}</Text>
                        <Text style={styles.alertMsg}>{customAlert.message}</Text>
                        <TouchableOpacity
                            style={styles.alertBtn}
                            onPress={() => setCustomAlert({ ...customAlert, visible: false })}
                        >
                            <Text style={styles.alertBtnText}>Got it</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: C.bg,
    },
    heroSection: {
        paddingHorizontal: 14,
        paddingTop: 12,
        paddingBottom: 14,
    },
    heroRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    heroTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    heroSub: {
        fontSize: 11,
        color: C.textMuted,
        marginTop: 2,
    },
    syncBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.gold,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
    },
    syncBtnText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#0B192C',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        fontSize: 13,
        color: C.textSub,
    },
    scrollContent: {
        padding: 12,
    },
    pricingCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: C.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    iconBox: {
        width: 38,
        height: 38,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    serviceName: {
        fontSize: 14,
        fontWeight: '700',
        color: C.textMain,
    },
    serviceDesc: {
        fontSize: 11,
        color: C.textMuted,
        marginTop: 1,
    },
    badge: {
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
        marginLeft: 6,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '700',
    },
    sellingPriceBox: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        padding: 10,
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: C.gold,
        marginBottom: 12,
    },
    sellingLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: C.navy,
        letterSpacing: 0.5,
    },
    sellingSub: {
        fontSize: 10,
        color: C.textMuted,
        marginTop: 1,
    },
    sellingAmount: {
        fontSize: 18,
        fontWeight: '900',
        color: C.goldDk,
    },
    inputsRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 8,
    },
    inputCol: {
        flex: 1,
    },
    fieldLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: C.textSub,
        marginBottom: 4,
    },
    inputField: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: C.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 14,
        fontWeight: '700',
        color: C.textMain,
    },
    inputFieldFocused: {
        borderColor: C.navy,
        backgroundColor: '#FCFDFF',
    },
    presetRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 2,
    },
    presetLabel: {
        fontSize: 10,
        color: C.textMuted,
        fontWeight: '600',
    },
    presetBtn: {
        backgroundColor: C.navyLight,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
    },
    presetBtnText: {
        fontSize: 10,
        fontWeight: '700',
        color: C.navy,
    },
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: C.border,
        padding: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 6,
    },
    saveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: C.gold,
        borderRadius: 10,
        paddingVertical: 12,
    },
    saveBtnText: {
        color: '#0B192C',
        fontSize: 14,
        fontWeight: '800',
    },
    alertOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    alertCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 20,
        alignItems: 'center',
        width: '100%',
        maxWidth: 320,
    },
    alertIconBox: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    alertTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: C.textMain,
        marginBottom: 6,
        textAlign: 'center',
    },
    alertMsg: {
        fontSize: 12,
        color: C.textSub,
        textAlign: 'center',
        marginBottom: 16,
        lineHeight: 18,
    },
    alertBtn: {
        backgroundColor: C.navy,
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 8,
        width: '100%',
        alignItems: 'center',
    },
    alertBtnText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '700',
    },
});
