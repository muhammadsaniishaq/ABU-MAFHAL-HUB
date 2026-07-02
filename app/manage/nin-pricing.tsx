import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Modal, TextInput, StyleSheet, Platform, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../services/supabase';

export default function NinPricingBoard() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    
    const [prices, setPrices] = useState<any[]>([]);
    const [originalPrices, setOriginalPrices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // Tab State: 'nin' | 'ipe'
    const [activeTab, setActiveTab] = useState<'nin' | 'ipe' | 'validation' | 'personalization' | 'bvn'>('nin');
    
    // Input Focus State
    const [focusedInput, setFocusedInput] = useState<string | null>(null);

    // Custom Smooth Alert State
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

    useEffect(() => {
        fetchPrices();
    }, []);

    const fetchPrices = async () => {
        setLoading(true);
        try {
            // Auto-seed Personalization pricing entries if missing
            const persPricingDefaults = [
                { id: 'pers_status', service_category: 'personalization', name: 'Personalization', cost_price: 250, markup_price: 0 }
            ];

            for (const item of persPricingDefaults) {
                const { data: existing } = await supabase
                    .from('service_pricing')
                    .select('id')
                    .eq('id', item.id)
                    .maybeSingle();
                
                if (!existing) {
                    await supabase.from('service_pricing').insert(item);
                }
            }

            // Auto-seed BVN pricing entries if missing
            const bvnPricingDefaults = [
                { id: 'bvn_num_basic', service_category: 'bvn', name: 'BVN Number - Basic', cost_price: 200, markup_price: 0 },
                { id: 'bvn_num_advanced', service_category: 'bvn', name: 'BVN Number - Advanced', cost_price: 250, markup_price: 0 },
                { id: 'bvn_phone_basic', service_category: 'bvn', name: 'Phone Number - Basic', cost_price: 250, markup_price: 0 },
                { id: 'bvn_phone_advanced', service_category: 'bvn', name: 'Phone Number - Advanced', cost_price: 300, markup_price: 0 },
                { id: 'bvn_card', service_category: 'bvn', name: 'BVN Card Layout', cost_price: 250, markup_price: 0 }
            ];

            for (const item of bvnPricingDefaults) {
                const { data: existing } = await supabase
                    .from('service_pricing')
                    .select('id')
                    .eq('id', item.id)
                    .maybeSingle();
                
                if (!existing) {
                    await supabase.from('service_pricing').insert(item);
                }
            }

            const { data, error } = await supabase
                .from('service_pricing')
                .select('*')
                .in('service_category', ['nin', 'ipe', 'validation', 'personalization', 'bvn'])
                .order('name', { ascending: true });

            if (error) throw error;
            setPrices(data || []);
            setOriginalPrices(JSON.parse(JSON.stringify(data || []))); // Deep copy
        } catch (error: any) {
            showAlert('Database Error', error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

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

    const hasChanges = () => {
        return JSON.stringify(prices) !== JSON.stringify(originalPrices);
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            for (const item of prices) {
                const { error } = await supabase
                    .from('service_pricing')
                    .update({
                        cost_price: item.cost_price,
                        markup_price: item.markup_price,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', item.id);
                if (error) throw error;
            }
            setOriginalPrices(JSON.parse(JSON.stringify(prices))); // Reset original state
            showAlert('Prices Updated', 'All price changes have been saved to the registry.', 'success');
        } catch (error: any) {
            showAlert('Save Failed', error.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const filteredPrices = prices.filter(p => p.service_category === activeTab);

    return (
        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
            style={{ flex: 1, backgroundColor: '#f4f6fb' }}
        >
            <Stack.Screen options={{
                title: 'Price Controller',
                headerStyle: { backgroundColor: '#060d21' },
                headerTintColor: '#fff',
                headerShadowVisible: false,
                headerLeft: () => (
                    <TouchableOpacity onPress={() => router.back()} style={{ paddingRight: 16 }}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                )
            }} />
            <StatusBar style="light" />

            {/* Custom Modern Alert Dialog */}
            <Modal
                transparent
                visible={customAlert.visible}
                animationType="fade"
                onRequestClose={() => setCustomAlert(prev => ({ ...prev, visible: false }))}
            >
                <View style={styles.alertOverlay}>
                    <View style={styles.alertCard}>
                        <View style={[
                            styles.alertIconBg,
                            customAlert.type === 'success' ? styles.alertSuccessIcon :
                            customAlert.type === 'error' ? styles.alertErrorIcon : styles.alertInfoIcon
                        ]}>
                            <Ionicons 
                                name={
                                    customAlert.type === 'success' ? 'checkmark-circle' :
                                    customAlert.type === 'error' ? 'close-circle' : 'information-circle'
                                } 
                                size={36} 
                                color={
                                    customAlert.type === 'success' ? '#10b981' :
                                    customAlert.type === 'error' ? '#ef4444' : '#3b82f6'
                                } 
                            />
                        </View>
                        <Text style={styles.alertTitle}>{customAlert.title}</Text>
                        <Text style={styles.alertMessage}>{customAlert.message}</Text>
                        <TouchableOpacity 
                            style={styles.alertButton} 
                            onPress={() => setCustomAlert(prev => ({ ...prev, visible: false }))}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.alertButtonText}>Okay</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Premium Gradient Header */}
            <LinearGradient colors={['#060d21', '#0F1E4C']} style={[styles.headerGradient, { paddingTop: 12 }]}>
                <View style={styles.headerRow}>
                    <View>
                        <Text style={styles.headerTitle}>Pricing Console</Text>
                        <Text style={styles.headerSub}>Manage service costs and markups</Text>
                    </View>
                    <View style={styles.badgeContainer}>
                        <Ionicons name="shield-checkmark" size={12} color="#f5a623" />
                        <Text style={styles.badgeText}>Admin Mode</Text>
                    </View>
                </View>

                {/* Dashboard Stats */}
                <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                        <Text style={styles.statVal}>{prices.filter(p => p.service_category === 'bvn').length}</Text>
                        <Text style={styles.statLabel}>BVN</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statVal}>{prices.filter(p => p.service_category === 'personalization').length}</Text>
                        <Text style={styles.statLabel}>Personalize</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statVal}>{prices.filter(p => p.service_category === 'validation').length}</Text>
                        <Text style={styles.statLabel}>Validation</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statVal}>{prices.filter(p => p.service_category === 'nin').length}</Text>
                        <Text style={styles.statLabel}>NIN Slips</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statVal}>{prices.filter(p => p.service_category === 'ipe').length}</Text>
                        <Text style={styles.statLabel}>IPE Clearances</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statVal}>
                            {prices.length > 0 ? `₦${Math.round(prices.reduce((acc, p) => acc + Number(p.markup_price), 0) / prices.length)}` : '₦0'}
                        </Text>
                        <Text style={styles.statLabel}>Avg Profit</Text>
                    </View>
                </View>
            </LinearGradient>

            {/* Smooth Tab Selectors */}
            <View style={styles.tabContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity 
                        onPress={() => setActiveTab('nin')}
                        style={[styles.tabButton, activeTab === 'nin' && styles.tabButtonActive, { paddingHorizontal: 12, marginRight: 4 }]}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="document-text" size={13} color={activeTab === 'nin' ? '#ffffff' : '#64748b'} />
                        <Text style={[styles.tabText, activeTab === 'nin' && styles.tabTextActive, { fontSize: 10 }]}>NIN Slips</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => setActiveTab('ipe')}
                        style={[styles.tabButton, activeTab === 'ipe' && styles.tabButtonActive, { paddingHorizontal: 12, marginRight: 4 }]}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="shield-checkmark" size={13} color={activeTab === 'ipe' ? '#ffffff' : '#64748b'} />
                        <Text style={[styles.tabText, activeTab === 'ipe' && styles.tabTextActive, { fontSize: 10 }]}>IPE</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => setActiveTab('validation')}
                        style={[styles.tabButton, activeTab === 'validation' && styles.tabButtonActive, { paddingHorizontal: 12, marginRight: 4 }]}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="checkmark-circle" size={13} color={activeTab === 'validation' ? '#ffffff' : '#64748b'} />
                        <Text style={[styles.tabText, activeTab === 'validation' && styles.tabTextActive, { fontSize: 10 }]}>Validation</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => setActiveTab('personalization')}
                        style={[styles.tabButton, activeTab === 'personalization' && styles.tabButtonActive, { paddingHorizontal: 12, marginRight: 4 }]}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="sparkles" size={13} color={activeTab === 'personalization' ? '#ffffff' : '#64748b'} />
                        <Text style={[styles.tabText, activeTab === 'personalization' && styles.tabTextActive, { fontSize: 10 }]}>Personalize</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => setActiveTab('bvn')}
                        style={[styles.tabButton, activeTab === 'bvn' && styles.tabButtonActive, { paddingHorizontal: 12 }]}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="finger-print" size={13} color={activeTab === 'bvn' ? '#ffffff' : '#64748b'} />
                        <Text style={[styles.tabText, activeTab === 'bvn' && styles.tabTextActive, { fontSize: 10 }]}>BVN</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>

            <ScrollView 
                style={{ flex: 1 }} 
                contentContainerStyle={[styles.scrollContent, { paddingBottom: hasChanges() ? 100 : 40 }]}
                showsVerticalScrollIndicator={false}
            >
                {loading ? (
                    <View style={styles.loaderBox}>
                        <ActivityIndicator size="large" color="#060d21" />
                        <Text style={styles.loaderText}>Fetching pricing details...</Text>
                    </View>
                ) : filteredPrices.length === 0 ? (
                    <View style={styles.emptyBox}>
                        <Ionicons name="alert-circle-outline" size={48} color="#94a3b8" />
                        <Text style={styles.emptyText}>No pricing cards configured for this category.</Text>
                    </View>
                ) : (
                    filteredPrices.map((item) => {
                        const total = Number(item.cost_price) + Number(item.markup_price);
                        const marginPercent = item.cost_price > 0 ? ((item.markup_price / item.cost_price) * 100).toFixed(1) : '100';
                        
                        return (
                            <View key={item.id} style={styles.priceCard}>
                                {/* Card Header */}
                                <View style={styles.cardHeader}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.cardTitle}>{item.name}</Text>
                                        <Text style={styles.cardId}>ID: {item.id}</Text>
                                    </View>
                                    <View style={styles.totalBadge}>
                                        <Text style={styles.totalBadgeLabel}>Customer Pays</Text>
                                        <Text style={styles.totalBadgeVal}>₦{total.toLocaleString()}</Text>
                                    </View>
                                </View>

                                {/* Form Fields */}
                                <View style={styles.formRow}>
                                    {/* Cost Price */}
                                    <View style={styles.inputWrapper}>
                                        <Text style={styles.inputLabel}>Cost Price (Base)</Text>
                                        <View style={[
                                            styles.inputFieldContainer,
                                            focusedInput === `${item.id}_cost` && styles.inputFocused
                                        ]}>
                                            <Ionicons name="logo-bitcoin" size={14} color="#64748b" style={{ marginRight: 6 }} />
                                            <Text style={styles.currencyPrefix}>₦</Text>
                                            <TextInput
                                                style={styles.textInputStyle}
                                                value={String(item.cost_price)}
                                                onChangeText={(val) => updateCost(item.id, val)}
                                                keyboardType="number-pad"
                                                onFocus={() => setFocusedInput(`${item.id}_cost`)}
                                                onBlur={() => setFocusedInput(null)}
                                            />
                                        </View>
                                    </View>

                                    {/* Markup Price */}
                                    <View style={styles.inputWrapper}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text style={styles.inputLabel}>Profit (Markup)</Text>
                                            <Text style={styles.marginText}>+{marginPercent}%</Text>
                                        </View>
                                        <View style={[
                                            styles.inputFieldContainer,
                                            focusedInput === `${item.id}_markup` && styles.inputFocusedMarkup
                                        ]}>
                                            <Ionicons name="trending-up" size={14} color="#4f46e5" style={{ marginRight: 6 }} />
                                            <Text style={styles.currencyPrefixMarkup}>₦</Text>
                                            <TextInput
                                                style={[styles.textInputStyle, styles.markupTextInput]}
                                                value={String(item.markup_price)}
                                                onChangeText={(val) => updateMarkup(item.id, val)}
                                                keyboardType="number-pad"
                                                onFocus={() => setFocusedInput(`${item.id}_markup`)}
                                                onBlur={() => setFocusedInput(null)}
                                            />
                                        </View>
                                    </View>
                                </View>
                            </View>
                        );
                    })
                )}
            </ScrollView>

            {/* Sticky Floating Save Bar */}
            {hasChanges() && !loading && (
                <View style={[styles.saveBar, { paddingBottom: insets.bottom > 0 ? insets.bottom + 8 : 12 }]}>
                    <TouchableOpacity
                        onPress={handleSave}
                        disabled={saving}
                        style={styles.saveButton}
                        activeOpacity={0.8}
                    >
                        {saving ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <>
                                <Ionicons name="cloud-upload" size={18} color="#fff" style={{ marginRight: 8 }} />
                                <Text style={styles.saveButtonText}>SAVE PRICE CHANGES</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            )}
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    sectionHeaderTitle: {
        fontSize: 12,
        fontWeight: '900',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 16,
    },
    alertOverlay: {
        flex: 1,
        backgroundColor: 'rgba(5, 11, 20, 0.75)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    alertCard: {
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        width: '85%',
        maxWidth: 320,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
    },
    alertIconBg: {
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    alertSuccessIcon: {
        backgroundColor: '#ecfdf5',
    },
    alertErrorIcon: {
        backgroundColor: '#fef2f2',
    },
    alertInfoIcon: {
        backgroundColor: '#eff6ff',
    },
    alertTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: '#0d1b3e',
        marginBottom: 8,
        textAlign: 'center',
        letterSpacing: -0.2,
    },
    alertMessage: {
        fontSize: 12,
        color: '#475569',
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 20,
        fontWeight: '500',
        paddingHorizontal: 8,
    },
    alertButton: {
        backgroundColor: '#0d1b3e',
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        shadowColor: '#0d1b3e',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 2,
    },
    alertButtonText: {
        color: '#ffffff',
        fontWeight: '800',
        fontSize: 13,
    },
    headerGradient: {
        paddingHorizontal: 16,
        paddingBottom: 20,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    headerTitle: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: '900',
        letterSpacing: -0.5,
    },
    headerSub: {
        fontSize: 11,
        color: '#94a3b8',
        fontWeight: '500',
    },
    badgeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(245, 166, 35, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(245, 166, 35, 0.3)',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    badgeText: {
        color: '#f5a623',
        fontSize: 10,
        fontWeight: '800',
        marginLeft: 4,
        textTransform: 'uppercase',
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    statCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 14,
        paddingVertical: 10,
        paddingHorizontal: 12,
        width: '15.5%',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    statVal: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '900',
    },
    statLabel: {
        color: '#94a3b8',
        fontSize: 9,
        fontWeight: '600',
        marginTop: 2,
        textTransform: 'uppercase',
    },
    tabContainer: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 4,
        marginHorizontal: 16,
        marginTop: -16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        height: 48,
        justifyContent: 'center',
    },
    tabButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 38,
        borderRadius: 12,
    },
    tabButtonActive: {
        backgroundColor: '#060d21',
    },
    tabText: {
        color: '#64748b',
        fontSize: 12,
        fontWeight: '700',
        marginLeft: 6,
    },
    tabTextActive: {
        color: '#ffffff',
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 24,
    },
    loaderBox: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    loaderText: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '600',
        marginTop: 12,
    },
    emptyBox: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '600',
        marginTop: 12,
        textAlign: 'center',
    },
    priceCard: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 1,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingBottom: 12,
        marginBottom: 14,
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '900',
        color: '#0f172a',
    },
    cardId: {
        fontSize: 10,
        color: '#94a3b8',
        fontWeight: '600',
        marginTop: 2,
    },
    totalBadge: {
        backgroundColor: '#f0fdf4',
        borderWidth: 1,
        borderColor: '#bbf7d0',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 6,
        alignItems: 'flex-end',
    },
    totalBadgeLabel: {
        fontSize: 8,
        color: '#16a34a',
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    totalBadgeVal: {
        fontSize: 14,
        fontWeight: '900',
        color: '#15803d',
        marginTop: 1,
    },
    formRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    inputWrapper: {
        width: '48.5%',
    },
    inputLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: '#64748b',
        marginBottom: 6,
        textTransform: 'uppercase',
    },
    marginText: {
        fontSize: 9,
        fontWeight: '800',
        color: '#4f46e5',
    },
    inputFieldContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 12,
        paddingHorizontal: 10,
        height: 44,
    },
    inputFocused: {
        borderColor: '#060d21',
        backgroundColor: '#ffffff',
    },
    inputFocusedMarkup: {
        borderColor: '#4f46e5',
        backgroundColor: '#ffffff',
    },
    currencyPrefix: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1e293b',
        marginRight: 2,
    },
    currencyPrefixMarkup: {
        fontSize: 14,
        fontWeight: '900',
        color: '#4f46e5',
        marginRight: 2,
    },
    textInputStyle: {
        flex: 1,
        color: '#1e293b',
        fontWeight: '700',
        fontSize: 14.5,
        paddingVertical: 0,
    },
    markupTextInput: {
        color: '#4f46e5',
        fontWeight: '900',
    },
    saveBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#ffffff',
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        paddingHorizontal: 16,
        paddingTop: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 10,
    },
    saveButton: {
        backgroundColor: '#060d21',
        height: 48,
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        shadowColor: '#060d21',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    saveButtonText: {
        color: '#ffffff',
        fontWeight: '900',
        fontSize: 13,
        letterSpacing: 0.8,
    },
});
