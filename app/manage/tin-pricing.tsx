import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    TextInput,
    ActivityIndicator,
    Alert,
    Platform,
    RefreshControl,
    StyleSheet,
    Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../services/supabase';

// Executive Palette
const COLORS = {
    navyDark: '#0A1128',
    navy: '#0F172A',
    navyMid: '#1E293B',
    navyLight: '#334155',
    navySoft: '#F1F5F9',
    gold: '#D97706',
    goldBright: '#F59E0B',
    goldLight: '#FEF3C7',
    goldBg: '#FFFBEB',
    goldBorder: '#FDE68A',
    bg: '#F8FAFC',
    card: '#FFFFFF',
    border: '#E2E8F0',
    borderFocus: '#059669',
    textMain: '#0F172A',
    textSub: '#475569',
    textMuted: '#94A3B8',
    success: '#10B981',
    successBg: '#ECFDF5',
    successBorder: '#A7F3D0',
    danger: '#EF4444',
    dangerBg: '#FEF2F2',
    dangerBorder: '#FECACA',
    emerald: '#059669',
    emeraldLight: '#ECFDF5',
    white: '#FFFFFF',
};

export interface TinPricingState {
    individualPrice: string;
    individualActive: boolean;
    businessPrice: string;
    businessActive: boolean;
}

export default function TinPricingManagement() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);

    // Pricing state differentiated by Individual vs Business/Corporate
    const [pricing, setPricing] = useState<TinPricingState>({
        individualPrice: '1500',
        individualActive: true,
        businessPrice: '3000',
        businessActive: true,
    });

    useEffect(() => {
        loadPricing();
    }, []);

    const loadPricing = async () => {
        setLoading(true);
        try {
            // 1. Try reading from app_settings
            const { data: settingsData } = await supabase
                .from('app_settings')
                .select('key, value')
                .in('key', [
                    'tin_pricing_controls',
                    'price_tin_individual',
                    'price_tin_business',
                    'price_tin_certificate',
                    'price_tin_registration'
                ]);

            let indivPrice = '1500';
            let indivActive = true;
            let bizPrice = '3000';
            let bizActive = true;

            let foundInSettings = false;

            if (settingsData && settingsData.length > 0) {
                settingsData.forEach(item => {
                    if (item.key === 'tin_pricing_controls' && item.value) {
                        try {
                            const parsed = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
                            
                            // Check individual
                            if (parsed?.individual_tin?.selling_price !== undefined) {
                                indivPrice = String(parsed.individual_tin.selling_price);
                                foundInSettings = true;
                            } else if (parsed?.tin_certificate?.selling_price !== undefined) {
                                indivPrice = String(parsed.tin_certificate.selling_price);
                                foundInSettings = true;
                            }

                            if (parsed?.individual_tin?.is_active !== undefined) {
                                indivActive = Boolean(parsed.individual_tin.is_active);
                            } else if (parsed?.tin_certificate?.is_active !== undefined) {
                                indivActive = Boolean(parsed.tin_certificate.is_active);
                            }

                            // Check business
                            if (parsed?.business_tin?.selling_price !== undefined) {
                                bizPrice = String(parsed.business_tin.selling_price);
                                foundInSettings = true;
                            } else if (parsed?.tin_registration?.selling_price !== undefined) {
                                bizPrice = String(parsed.tin_registration.selling_price);
                                foundInSettings = true;
                            }

                            if (parsed?.business_tin?.is_active !== undefined) {
                                bizActive = Boolean(parsed.business_tin.is_active);
                            } else if (parsed?.tin_registration?.is_active !== undefined) {
                                bizActive = Boolean(parsed.tin_registration.is_active);
                            }
                        } catch (_) {}
                    }
                    if (item.key === 'price_tin_individual' && item.value) {
                        const val = parseFloat(item.value);
                        if (!isNaN(val) && val >= 0) {
                            indivPrice = String(val);
                            foundInSettings = true;
                        }
                    }
                    if (item.key === 'price_tin_business' && item.value) {
                        const val = parseFloat(item.value);
                        if (!isNaN(val) && val >= 0) {
                            bizPrice = String(val);
                            foundInSettings = true;
                        }
                    }
                });
            }

            // 2. Fallback to service_pricing table if not found in app_settings
            if (!foundInSettings) {
                const { data: spRows } = await supabase
                    .from('service_pricing')
                    .select('id, cost_price, markup_price, is_active')
                    .in('id', ['individual_tin', 'business_tin', 'tin_certificate', 'tin_registration']);

                if (spRows && spRows.length > 0) {
                    spRows.forEach((r: any) => {
                        const total = Number(r.cost_price || 0) + Number(r.markup_price || 0);
                        if (r.id === 'individual_tin' || r.id === 'tin_certificate') {
                            if (total > 0) indivPrice = String(total);
                            if (typeof r.is_active === 'boolean') indivActive = r.is_active;
                        }
                        if (r.id === 'business_tin' || r.id === 'tin_registration') {
                            if (total > 0) bizPrice = String(total);
                            if (typeof r.is_active === 'boolean') bizActive = r.is_active;
                        }
                    });
                }
            }

            setPricing({
                individualPrice: indivPrice,
                individualActive: indivActive,
                businessPrice: bizPrice,
                businessActive: bizActive,
            });
        } catch (e) {
            console.warn('Error loading TIN pricing:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleSave = async () => {
        const indivFee = parseFloat(pricing.individualPrice);
        const bizFee = parseFloat(pricing.businessPrice);

        if (isNaN(indivFee) || indivFee < 0) {
            return Alert.alert('Invalid Price', 'Please enter a valid price for Individual Tax ID / TIN.');
        }

        if (isNaN(bizFee) || bizFee < 0) {
            return Alert.alert('Invalid Price', 'Please enter a valid price for Business / Corporate Tax ID / TIN.');
        }

        setSaving(true);
        try {
            const now = new Date().toISOString();

            const updatedPricingControls = {
                individual_tin: {
                    id: 'individual_tin',
                    title: 'Individual Tax ID (TIN)',
                    selling_price: indivFee,
                    cost_price: 0,
                    is_active: pricing.individualActive,
                },
                business_tin: {
                    id: 'business_tin',
                    title: 'Business / Corporate Tax ID (TIN)',
                    selling_price: bizFee,
                    cost_price: 0,
                    is_active: pricing.businessActive,
                },
                // Backwards-compatibility aliases
                tin_certificate: {
                    id: 'tin_certificate',
                    title: 'Individual Tax ID (TIN)',
                    selling_price: indivFee,
                    cost_price: 0,
                    is_active: pricing.individualActive,
                },
                tin_registration: {
                    id: 'tin_registration',
                    title: 'Business / Corporate Tax ID (TIN)',
                    selling_price: bizFee,
                    cost_price: 0,
                    is_active: pricing.businessActive,
                },
            };

            // 1. Save to app_settings (used by the mobile app, web portal, and automated flows)
            const { error: settingsErr } = await supabase.from('app_settings').upsert([
                {
                    key: 'tin_pricing_controls',
                    value: updatedPricingControls,
                    updated_at: now,
                },
                {
                    key: 'price_tin_individual',
                    value: String(indivFee),
                    updated_at: now,
                },
                {
                    key: 'price_tin_business',
                    value: String(bizFee),
                    updated_at: now,
                },
                {
                    key: 'price_tin_certificate',
                    value: String(indivFee),
                    updated_at: now,
                },
                {
                    key: 'price_tin_registration',
                    value: String(bizFee),
                    updated_at: now,
                },
            ], { onConflict: 'key' });

            if (settingsErr) throw settingsErr;

            // 2. Sync to service_pricing table
            try {
                await supabase.from('service_pricing').upsert([
                    {
                        id: 'individual_tin',
                        service_name: 'Individual Tax ID (TIN)',
                        cost_price: indivFee,
                        markup_price: 0,
                        is_active: pricing.individualActive,
                    },
                    {
                        id: 'business_tin',
                        service_name: 'Business / Corporate Tax ID (TIN)',
                        cost_price: bizFee,
                        markup_price: 0,
                        is_active: pricing.businessActive,
                    },
                    {
                        id: 'tin_certificate',
                        service_name: 'Individual Tax ID (TIN)',
                        cost_price: indivFee,
                        markup_price: 0,
                        is_active: pricing.individualActive,
                    },
                    {
                        id: 'tin_registration',
                        service_name: 'Business / Corporate Tax ID (TIN)',
                        cost_price: bizFee,
                        markup_price: 0,
                        is_active: pricing.businessActive,
                    },
                ], { onConflict: 'id' });
            } catch (spErr) {
                console.warn('Optional service_pricing sync note:', spErr);
            }

            // 3. Log audit event
            try {
                const { data: authData } = await supabase.auth.getUser();
                if (authData?.user) {
                    await supabase.from('audit_logs').insert({
                        admin_id: authData.user.id,
                        action: 'Updated TIN Service Pricing (Individual & Business)',
                        resource_id: 'tin_pricing',
                        details: {
                            individual_price: indivFee,
                            individual_active: pricing.individualActive,
                            business_price: bizFee,
                            business_active: pricing.businessActive,
                        },
                        created_at: now,
                    });
                }
            } catch (_) {}

            Alert.alert('Settings Saved', 'Individual and Business Tax ID (TIN) pricing updated successfully.');
            loadPricing();
        } catch (err: any) {
            console.error('Save error:', err);
            Alert.alert('Error', err.message || 'Failed to update pricing.');
        } finally {
            setSaving(false);
        }
    };

    const indivPresets = ['1000', '1500', '2000', '2500', '3000'];
    const bizPresets = ['2500', '3000', '4000', '5000', '7500'];

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: 'TIN / Tax ID Pricing',
                    headerStyle: { backgroundColor: COLORS.navyDark },
                    headerTintColor: COLORS.white,
                    headerShadowVisible: false,
                    headerLeft: () => (
                        <TouchableOpacity
                            onPress={() => router.back()}
                            style={styles.headerBackBtn}
                        >
                            <Ionicons name="arrow-back" size={20} color={COLORS.white} />
                        </TouchableOpacity>
                    ),
                    headerRight: () => (
                        <TouchableOpacity
                            onPress={handleSave}
                            disabled={saving}
                            style={[styles.headerSaveBtn, saving && { opacity: 0.7 }]}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color={COLORS.white} />
                            ) : (
                                <>
                                    <Ionicons name="checkmark-done" size={16} color={COLORS.white} style={{ marginRight: 4 }} />
                                    <Text style={styles.headerSaveBtnText}>Save</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    ),
                }}
            />

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.gold} />
                    <Text style={styles.loadingText}>Loading Tax ID & TIN Pricing...</Text>
                </View>
            ) : (
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={[
                        styles.scrollContent,
                        { paddingBottom: Math.max(insets.bottom, 24) + 100 }
                    ]}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={loadPricing} tintColor={COLORS.gold} />
                    }
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Header Banner */}
                    <LinearGradient
                        colors={[COLORS.navyDark, COLORS.navyMid]}
                        style={styles.heroBanner}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <View style={styles.heroBadge}>
                            <Ionicons name="shield-checkmark" size={13} color={COLORS.gold} style={{ marginRight: 4 }} />
                            <Text style={styles.heroBadgeText}>OFFICIAL JTB / FIRS TAX ID RATES</Text>
                        </View>
                        <Text style={styles.heroTitle}>Tax ID / TIN Pricing Configuration</Text>
                        <Text style={styles.heroSub}>
                            Configure service charges for Individual Tax Identification Numbers versus Business & Corporate CAC Registrations.
                        </Text>
                    </LinearGradient>

                    {/* Notice Card */}
                    <View style={styles.infoCallout}>
                        <Ionicons name="information-circle" size={20} color={COLORS.gold} style={{ marginRight: 10 }} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.infoCalloutTitle}>Unified Tax ID & TIN Architecture</Text>
                            <Text style={styles.infoCalloutText}>
                                In Nigeria, Tax ID and TIN refer to the same identifier. Pricing is categorized by entity type (Individual vs Registered Business) so customers pay a direct, transparent service fee without confusion.
                            </Text>
                        </View>
                    </View>

                    {/* SECTION 1: INDIVIDUAL TAX ID / TIN */}
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <View style={[styles.cardHeaderIconBox, { backgroundColor: '#ECFDF5' }]}>
                                <Ionicons name="person" size={20} color={COLORS.emerald} />
                            </View>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={styles.cardTitle}>Individual Tax ID / TIN</Text>
                                <Text style={styles.cardSub}>
                                    Personal Tax ID lookup, certificate retrieval, and new individual TIN applications.
                                </Text>
                            </View>
                            <Switch
                                value={pricing.individualActive}
                                onValueChange={(val) => setPricing(prev => ({ ...prev, individualActive: val }))}
                                trackColor={{ false: '#CBD5E1', true: COLORS.emerald }}
                                thumbColor={COLORS.white}
                            />
                        </View>

                        <View style={styles.cardDivider} />

                        {/* Service Fee Input */}
                        <Text style={styles.fieldLabel}>Direct Service Fee (₦):</Text>
                        <View style={styles.inputWrapper}>
                            <Text style={styles.inputPrefix}>₦</Text>
                            <TextInput
                                style={styles.textInput}
                                value={pricing.individualPrice}
                                onChangeText={(text) => setPricing(prev => ({ ...prev, individualPrice: text.replace(/[^0-9]/g, '') }))}
                                placeholder="1500"
                                keyboardType="numeric"
                                placeholderTextColor={COLORS.textMuted}
                            />
                        </View>

                        {/* Quick Presets */}
                        <Text style={styles.presetLabel}>Quick Presets:</Text>
                        <View style={styles.presetsRow}>
                            {indivPresets.map(val => (
                                <TouchableOpacity
                                    key={val}
                                    style={[
                                        styles.presetChip,
                                        pricing.individualPrice === val && styles.presetChipActive
                                    ]}
                                    onPress={() => setPricing(prev => ({ ...prev, individualPrice: val }))}
                                >
                                    <Text style={[
                                        styles.presetChipText,
                                        pricing.individualPrice === val && styles.presetChipTextActive
                                    ]}>
                                        ₦{Number(val).toLocaleString()}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.cardStatusRow}>
                            <Text style={styles.statusLabel}>Service Status:</Text>
                            <View style={[
                                styles.statusPill,
                                { backgroundColor: pricing.individualActive ? COLORS.successBg : COLORS.dangerBg }
                            ]}>
                                <Text style={[
                                    styles.statusPillText,
                                    { color: pricing.individualActive ? COLORS.success : COLORS.danger }
                                ]}>
                                    {pricing.individualActive ? 'ACTIVE & AVAILABLE' : 'DISABLED'}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* SECTION 2: BUSINESS / CORPORATE TAX ID / TIN */}
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <View style={[styles.cardHeaderIconBox, { backgroundColor: '#EFF6FF' }]}>
                                <Ionicons name="business" size={20} color="#2563EB" />
                            </View>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={styles.cardTitle}>Business & Corporate Tax ID / TIN</Text>
                                <Text style={styles.cardSub}>
                                    CAC Registered Companies (RC), Business Names (BN), Enterprises, and NGOs.
                                </Text>
                            </View>
                            <Switch
                                value={pricing.businessActive}
                                onValueChange={(val) => setPricing(prev => ({ ...prev, businessActive: val }))}
                                trackColor={{ false: '#CBD5E1', true: '#2563EB' }}
                                thumbColor={COLORS.white}
                            />
                        </View>

                        <View style={styles.cardDivider} />

                        {/* Service Fee Input */}
                        <Text style={styles.fieldLabel}>Direct Service Fee (₦):</Text>
                        <View style={styles.inputWrapper}>
                            <Text style={styles.inputPrefix}>₦</Text>
                            <TextInput
                                style={styles.textInput}
                                value={pricing.businessPrice}
                                onChangeText={(text) => setPricing(prev => ({ ...prev, businessPrice: text.replace(/[^0-9]/g, '') }))}
                                placeholder="3000"
                                keyboardType="numeric"
                                placeholderTextColor={COLORS.textMuted}
                            />
                        </View>

                        {/* Quick Presets */}
                        <Text style={styles.presetLabel}>Quick Presets:</Text>
                        <View style={styles.presetsRow}>
                            {bizPresets.map(val => (
                                <TouchableOpacity
                                    key={val}
                                    style={[
                                        styles.presetChip,
                                        pricing.businessPrice === val && [styles.presetChipActive, { borderColor: '#2563EB', backgroundColor: '#EFF6FF' }]
                                    ]}
                                    onPress={() => setPricing(prev => ({ ...prev, businessPrice: val }))}
                                >
                                    <Text style={[
                                        styles.presetChipText,
                                        pricing.businessPrice === val && [styles.presetChipTextActive, { color: '#2563EB' }]
                                    ]}>
                                        ₦{Number(val).toLocaleString()}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.cardStatusRow}>
                            <Text style={styles.statusLabel}>Service Status:</Text>
                            <View style={[
                                styles.statusPill,
                                { backgroundColor: pricing.businessActive ? COLORS.successBg : COLORS.dangerBg }
                            ]}>
                                <Text style={[
                                    styles.statusPillText,
                                    { color: pricing.businessActive ? COLORS.success : COLORS.danger }
                                ]}>
                                    {pricing.businessActive ? 'ACTIVE & AVAILABLE' : 'DISABLED'}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* LIVE SUMMARY CARD */}
                    <View style={styles.summaryCard}>
                        <Text style={styles.summaryTitle}>Live Pricing Overview for Users</Text>
                        <Text style={styles.summarySub}>These rates will be displayed in the customer TIN services portal.</Text>

                        <View style={styles.summaryRow}>
                            <View style={styles.summaryItem}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="person-circle" size={18} color={COLORS.emerald} style={{ marginRight: 6 }} />
                                    <Text style={styles.summaryItemLabel}>Individual TIN</Text>
                                </View>
                                <Text style={styles.summaryItemValue}>
                                    ₦{Number(pricing.individualPrice || 0).toLocaleString()}
                                </Text>
                                <Text style={styles.summaryItemSub}>Personal / Salary / NIN</Text>
                            </View>

                            <View style={styles.summaryDividerVertical} />

                            <View style={styles.summaryItem}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="business" size={18} color="#2563EB" style={{ marginRight: 6 }} />
                                    <Text style={styles.summaryItemLabel}>Business TIN</Text>
                                </View>
                                <Text style={[styles.summaryItemValue, { color: '#2563EB' }]}>
                                    ₦{Number(pricing.businessPrice || 0).toLocaleString()}
                                </Text>
                                <Text style={styles.summaryItemSub}>CAC / RC / Enterprise</Text>
                            </View>
                        </View>
                    </View>

                    {/* Big Action Save Button */}
                    <TouchableOpacity
                        style={[styles.bigSaveBtn, saving && { opacity: 0.7 }]}
                        onPress={handleSave}
                        disabled={saving}
                        activeOpacity={0.8}
                    >
                        {saving ? (
                            <ActivityIndicator color={COLORS.white} />
                        ) : (
                            <View style={styles.saveBtnContent}>
                                <Ionicons name="save" size={20} color={COLORS.white} style={{ marginRight: 8 }} />
                                <Text style={styles.bigSaveBtnText}>Save All Pricing Changes</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg,
    },
    headerBackBtn: {
        padding: 6,
        marginRight: 6,
    },
    headerSaveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.gold,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    headerSaveBtnText: {
        color: COLORS.white,
        fontWeight: '700',
        fontSize: 13,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    loadingText: {
        marginTop: 12,
        color: COLORS.textSub,
        fontSize: 14,
        fontWeight: '500',
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
    },
    heroBanner: {
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
    },
    heroBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(217, 119, 6, 0.15)',
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        marginBottom: 8,
    },
    heroBadgeText: {
        color: COLORS.gold,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    heroTitle: {
        color: COLORS.white,
        fontSize: 20,
        fontWeight: '800',
        marginBottom: 6,
    },
    heroSub: {
        color: '#94A3B8',
        fontSize: 13,
        lineHeight: 18,
    },
    infoCallout: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: COLORS.goldBg,
        borderWidth: 1,
        borderColor: COLORS.goldBorder,
        borderRadius: 12,
        padding: 14,
        marginBottom: 16,
    },
    infoCalloutTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#92400E',
        marginBottom: 2,
    },
    infoCalloutText: {
        fontSize: 12,
        color: '#78350F',
        lineHeight: 17,
    },
    card: {
        backgroundColor: COLORS.card,
        borderRadius: 16,
        padding: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 16,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 6,
            },
            android: { elevation: 2 },
        }),
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    cardHeaderIconBox: {
        width: 42,
        height: 42,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: COLORS.textMain,
    },
    cardSub: {
        fontSize: 12,
        color: COLORS.textSub,
        marginTop: 2,
        lineHeight: 16,
    },
    cardDivider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginVertical: 14,
    },
    fieldLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.textMain,
        marginBottom: 6,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: COLORS.border,
        borderRadius: 10,
        backgroundColor: COLORS.bg,
        paddingHorizontal: 12,
        height: 48,
    },
    inputPrefix: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.textSub,
        marginRight: 6,
    },
    textInput: {
        flex: 1,
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.textMain,
        height: '100%',
    },
    presetLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.textMuted,
        marginTop: 12,
        marginBottom: 6,
        textTransform: 'uppercase',
    },
    presetsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    presetChip: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.card,
    },
    presetChipActive: {
        borderColor: COLORS.emerald,
        backgroundColor: COLORS.emeraldLight,
    },
    presetChipText: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.textSub,
    },
    presetChipTextActive: {
        color: COLORS.emerald,
    },
    cardStatusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 14,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    statusLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.textSub,
    },
    statusPill: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusPillText: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    summaryCard: {
        backgroundColor: COLORS.navySoft,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 20,
    },
    summaryTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: COLORS.navyDark,
    },
    summarySub: {
        fontSize: 11,
        color: COLORS.textSub,
        marginTop: 2,
        marginBottom: 12,
    },
    summaryRow: {
        flexDirection: 'row',
        backgroundColor: COLORS.white,
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    summaryItem: {
        flex: 1,
    },
    summaryItemLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.textMain,
    },
    summaryItemValue: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.emerald,
        marginTop: 4,
    },
    summaryItemSub: {
        fontSize: 10,
        color: COLORS.textMuted,
        marginTop: 2,
    },
    summaryDividerVertical: {
        width: 1,
        backgroundColor: COLORS.border,
        marginHorizontal: 12,
    },
    bigSaveBtn: {
        backgroundColor: COLORS.gold,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: COLORS.gold,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 3,
    },
    saveBtnContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    bigSaveBtnText: {
        color: COLORS.white,
        fontSize: 15,
        fontWeight: '800',
    },
});
