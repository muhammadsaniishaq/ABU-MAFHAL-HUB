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
    certificatePrice: string;
    certificateActive: boolean;
    registrationPrice: string;
    registrationActive: boolean;
}

export default function TinPricingManagement() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);

    // Pricing state (straightforward service fee, no cost/markup split)
    const [pricing, setPricing] = useState<TinPricingState>({
        certificatePrice: '1500',
        certificateActive: true,
        registrationPrice: '2500',
        registrationActive: true,
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
                .in('key', ['tin_pricing_controls', 'price_tin_certificate', 'price_tin_registration']);

            let certPrice = '1500';
            let certActive = true;
            let regPrice = '2500';
            let regActive = true;

            let foundInSettings = false;

            if (settingsData && settingsData.length > 0) {
                settingsData.forEach(item => {
                    if (item.key === 'tin_pricing_controls' && item.value) {
                        try {
                            const parsed = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
                            if (parsed?.tin_certificate?.selling_price !== undefined) {
                                certPrice = String(parsed.tin_certificate.selling_price);
                                foundInSettings = true;
                            }
                            if (parsed?.tin_certificate?.is_active !== undefined) {
                                certActive = Boolean(parsed.tin_certificate.is_active);
                            }
                            if (parsed?.tin_registration?.selling_price !== undefined) {
                                regPrice = String(parsed.tin_registration.selling_price);
                                foundInSettings = true;
                            }
                            if (parsed?.tin_registration?.is_active !== undefined) {
                                regActive = Boolean(parsed.tin_registration.is_active);
                            }
                        } catch (_) {}
                    }
                    if (item.key === 'price_tin_certificate' && item.value) {
                        const val = parseFloat(item.value);
                        if (!isNaN(val) && val >= 0) {
                            certPrice = String(val);
                            foundInSettings = true;
                        }
                    }
                    if (item.key === 'price_tin_registration' && item.value) {
                        const val = parseFloat(item.value);
                        if (!isNaN(val) && val >= 0) {
                            regPrice = String(val);
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
                    .in('id', ['tin_certificate', 'tin_registration']);

                if (spRows && spRows.length > 0) {
                    spRows.forEach((r: any) => {
                        const total = Number(r.cost_price || 0) + Number(r.markup_price || 0);
                        if (r.id === 'tin_certificate') {
                            if (total > 0) certPrice = String(total);
                            if (typeof r.is_active === 'boolean') certActive = r.is_active;
                        }
                        if (r.id === 'tin_registration') {
                            if (total > 0) regPrice = String(total);
                            if (typeof r.is_active === 'boolean') regActive = r.is_active;
                        }
                    });
                }
            }

            setPricing({
                certificatePrice: certPrice,
                certificateActive: certActive,
                registrationPrice: regPrice,
                registrationActive: regActive,
            });
        } catch (e) {
            console.warn('Error loading TIN pricing:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleSave = async () => {
        const certFee = parseFloat(pricing.certificatePrice);
        const regFee = parseFloat(pricing.registrationPrice);

        if (isNaN(certFee) || certFee < 0) {
            return Alert.alert('Invalid Price', 'Please enter a valid price for Tax ID Certificate Retrieval.');
        }

        if (isNaN(regFee) || regFee < 0) {
            return Alert.alert('Invalid Price', 'Please enter a valid price for New TIN Registration.');
        }

        setSaving(true);
        try {
            const now = new Date().toISOString();

            const updatedPricingControls = {
                tin_certificate: {
                    id: 'tin_certificate',
                    title: 'Tax ID Certificate Retrieval',
                    selling_price: certFee,
                    cost_price: 0,
                    is_active: pricing.certificateActive,
                },
                tin_registration: {
                    id: 'tin_registration',
                    title: 'New TIN Registration',
                    selling_price: regFee,
                    cost_price: 0,
                    is_active: pricing.registrationActive,
                },
            };

            // 1. Save to app_settings (used by the app and bots)
            const { error: settingsErr } = await supabase.from('app_settings').upsert([
                {
                    key: 'tin_pricing_controls',
                    value: updatedPricingControls,
                    updated_at: now,
                },
                {
                    key: 'price_tin_certificate',
                    value: String(certFee),
                    updated_at: now,
                },
                {
                    key: 'price_tin_registration',
                    value: String(regFee),
                    updated_at: now,
                },
            ], { onConflict: 'key' });

            if (settingsErr) throw settingsErr;

            // 2. Sync to service_pricing table
            try {
                await supabase.from('service_pricing').upsert([
                    {
                        id: 'tin_certificate',
                        service_name: 'Tax ID Certificate Retrieval',
                        cost_price: certFee,
                        markup_price: 0,
                        is_active: pricing.certificateActive,
                    },
                    {
                        id: 'tin_registration',
                        service_name: 'New TIN Registration',
                        cost_price: regFee,
                        markup_price: 0,
                        is_active: pricing.registrationActive,
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
                        action: 'Updated TIN Service Pricing',
                        target_resource: 'TIN / Tax ID Pricing',
                        details: {
                            certificateFee: certFee,
                            certificateActive: pricing.certificateActive,
                            registrationFee: regFee,
                            registrationActive: pricing.registrationActive,
                            timestamp: now,
                        },
                    });
                }
            } catch (_) {}

            Alert.alert(
                'Pricing Saved Successfully! 🎉',
                `The new service prices are now live across the platform:\n\n• Certificate Retrieval: ₦${certFee.toLocaleString()}\n• New TIN Registration: ₦${regFee.toLocaleString()}`
            );
        } catch (err: any) {
            Alert.alert('Save Failed', err?.message || 'Failed to update TIN pricing in database.');
        } finally {
            setSaving(false);
        }
    };

    const bottomPadding = Math.max(insets.bottom, 24) + 60;

    return (
        <View style={s.container}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* HEADER */}
            <LinearGradient 
                colors={[COLORS.navyDark, COLORS.navy]} 
                style={[s.header, { paddingTop: Math.max(insets.top, 20) + 10 }]}
            >
                <TouchableOpacity 
                    onPress={() => router.back()} 
                    style={s.backBtn}
                    activeOpacity={0.7}
                >
                    <Ionicons name="arrow-back" size={20} color={COLORS.white} />
                </TouchableOpacity>

                <View style={s.headerCenter}>
                    <View style={s.badgeRow}>
                        <View style={s.emeraldDot} />
                        <Text style={s.headerBadge}>ADMIN CONTROL PANEL</Text>
                    </View>
                    <Text style={s.headerTitle}>TIN Service Pricing</Text>
                </View>

                <TouchableOpacity
                    onPress={handleSave}
                    disabled={saving || loading}
                    style={[s.saveHeaderBtn, (saving || loading) && { opacity: 0.7 }]}
                    activeOpacity={0.8}
                >
                    {saving ? (
                        <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                        <>
                            <Ionicons name="checkmark-circle" size={16} color={COLORS.white} />
                            <Text style={s.saveHeaderBtnText}>Save</Text>
                        </>
                    )}
                </TouchableOpacity>
            </LinearGradient>

            {loading ? (
                <View style={s.centered}>
                    <ActivityIndicator size="large" color={COLORS.emerald} />
                    <Text style={s.loadingText}>Loading TIN pricing from database...</Text>
                </View>
            ) : (
                <ScrollView
                    style={s.scroll}
                    contentContainerStyle={[s.content, { paddingBottom: bottomPadding }]}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl 
                            refreshing={refreshing} 
                            onRefresh={() => { setRefreshing(true); loadPricing(); }}
                            tintColor={COLORS.emerald}
                        />
                    }
                >
                    {/* INFO BANNER */}
                    <View style={s.infoCard}>
                        <View style={s.infoIconBox}>
                            <Ionicons name="pricetags-outline" size={20} color={COLORS.emerald} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={s.infoTitle}>Direct Platform Pricing</Text>
                            <Text style={s.infoDesc}>
                                Set the exact amount debited from customer wallets for each tax service. All payments are received directly by your platform without any external third-party API fee deductions.
                            </Text>
                        </View>
                    </View>

                    {/* ITEM 1: TAX ID CERTIFICATE RETRIEVAL */}
                    <View style={s.card}>
                        <View style={s.cardHeader}>
                            <View style={[s.iconBox, { backgroundColor: '#ECFDF5' }]}>
                                <Ionicons name="document-text" size={22} color={COLORS.emerald} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <View style={s.titleRow}>
                                    <Text style={s.cardTitle}>Tax ID Certificate Retrieval</Text>
                                    <View style={[s.statusBadge, pricing.certificateActive ? s.statusActive : s.statusInactive]}>
                                        <Text style={[s.statusText, pricing.certificateActive ? s.statusActiveText : s.statusInactiveText]}>
                                            {pricing.certificateActive ? 'ACTIVE' : 'DISABLED'}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={s.cardSub}>Search & Issue Existing JTB Certificate</Text>
                            </View>
                        </View>

                        <Text style={s.cardDesc}>
                            Fee charged to verify and issue official JTB Tax ID Certificate PDF for individuals or registered corporate entities.
                        </Text>

                        {/* TOGGLE SWITCH */}
                        <View style={s.switchRow}>
                            <View>
                                <Text style={s.switchLabel}>Enable Service in Mobile App</Text>
                                <Text style={s.switchSub}>Allow customers to submit retrieval requests</Text>
                            </View>
                            <Switch
                                value={pricing.certificateActive}
                                onValueChange={(v) => setPricing(prev => ({ ...prev, certificateActive: v }))}
                                trackColor={{ false: '#E2E8F0', true: COLORS.successBorder }}
                                thumbColor={pricing.certificateActive ? COLORS.emerald : '#94A3B8'}
                            />
                        </View>

                        {/* SINGLE CLEAN SERVICE FEE INPUT */}
                        <View style={s.feeInputGroup}>
                            <Text style={s.inputLabel}>Customer Service Fee (₦):</Text>
                            <View style={s.inputWrap}>
                                <Text style={s.currencyPrefix}>₦</Text>
                                <TextInput
                                    style={s.input}
                                    keyboardType="numeric"
                                    value={pricing.certificatePrice}
                                    onChangeText={(t) => setPricing(prev => ({ ...prev, certificatePrice: t.replace(/\D/g, '') }))}
                                    placeholder="1500"
                                    placeholderTextColor={COLORS.textMuted}
                                />
                            </View>
                        </View>

                        {/* QUICK PRESET BUTTONS */}
                        <View style={s.presetsRow}>
                            <Text style={s.presetLabel}>Quick Select:</Text>
                            {['1000', '1500', '2000', '2500'].map(p => (
                                <TouchableOpacity
                                    key={p}
                                    style={[s.presetPill, pricing.certificatePrice === p && s.presetPillActive]}
                                    onPress={() => setPricing(prev => ({ ...prev, certificatePrice: p }))}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[s.presetPillText, pricing.certificatePrice === p && s.presetPillTextActive]}>
                                        ₦{Number(p).toLocaleString()}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* ITEM 2: NEW TIN REGISTRATION */}
                    <View style={s.card}>
                        <View style={s.cardHeader}>
                            <View style={[s.iconBox, { backgroundColor: '#EFF6FF' }]}>
                                <Ionicons name="person-add" size={22} color="#2563EB" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <View style={s.titleRow}>
                                    <Text style={s.cardTitle}>New TIN Registration</Text>
                                    <View style={[s.statusBadge, pricing.registrationActive ? s.statusActive : s.statusInactive]}>
                                        <Text style={[s.statusText, pricing.registrationActive ? s.statusActiveText : s.statusInactiveText]}>
                                            {pricing.registrationActive ? 'ACTIVE' : 'DISABLED'}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={s.cardSub}>Individual & Business TIN Enrollment</Text>
                            </View>
                        </View>

                        <Text style={s.cardDesc}>
                            Fee charged to enroll and issue brand new Joint Tax Board (JTB) Tax Identification Numbers and certificates.
                        </Text>

                        {/* TOGGLE SWITCH */}
                        <View style={s.switchRow}>
                            <View>
                                <Text style={s.switchLabel}>Enable Service in Mobile App</Text>
                                <Text style={s.switchSub}>Allow customers to submit new registrations</Text>
                            </View>
                            <Switch
                                value={pricing.registrationActive}
                                onValueChange={(v) => setPricing(prev => ({ ...prev, registrationActive: v }))}
                                trackColor={{ false: '#E2E8F0', true: COLORS.successBorder }}
                                thumbColor={pricing.registrationActive ? COLORS.emerald : '#94A3B8'}
                            />
                        </View>

                        {/* SINGLE CLEAN SERVICE FEE INPUT */}
                        <View style={s.feeInputGroup}>
                            <Text style={s.inputLabel}>Customer Service Fee (₦):</Text>
                            <View style={s.inputWrap}>
                                <Text style={s.currencyPrefix}>₦</Text>
                                <TextInput
                                    style={s.input}
                                    keyboardType="numeric"
                                    value={pricing.registrationPrice}
                                    onChangeText={(t) => setPricing(prev => ({ ...prev, registrationPrice: t.replace(/\D/g, '') }))}
                                    placeholder="2500"
                                    placeholderTextColor={COLORS.textMuted}
                                />
                            </View>
                        </View>

                        {/* QUICK PRESET BUTTONS */}
                        <View style={s.presetsRow}>
                            <Text style={s.presetLabel}>Quick Select:</Text>
                            {['2000', '2500', '3000', '3500'].map(p => (
                                <TouchableOpacity
                                    key={p}
                                    style={[s.presetPill, pricing.registrationPrice === p && s.presetPillActive]}
                                    onPress={() => setPricing(prev => ({ ...prev, registrationPrice: p }))}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[s.presetPillText, pricing.registrationPrice === p && s.presetPillTextActive]}>
                                        ₦{Number(p).toLocaleString()}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* LIVE OVERVIEW BOX */}
                    <View style={s.overviewCard}>
                        <View style={s.overviewHeader}>
                            <Ionicons name="sparkles" size={16} color={COLORS.emerald} />
                            <Text style={s.overviewTitle}>Customer Pricing Summary</Text>
                        </View>

                        <View style={s.overviewRow}>
                            <Text style={s.overviewLabel}>Tax ID Certificate Retrieval:</Text>
                            <Text style={s.overviewValue}>
                                ₦{Number(pricing.certificatePrice || 0).toLocaleString()}
                            </Text>
                        </View>

                        <View style={s.overviewRow}>
                            <Text style={s.overviewLabel}>New TIN Registration:</Text>
                            <Text style={s.overviewValue}>
                                ₦{Number(pricing.registrationPrice || 0).toLocaleString()}
                            </Text>
                        </View>

                        <View style={s.overviewDivider} />

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="checkmark-done" size={14} color={COLORS.emerald} />
                            <Text style={s.overviewNote}>
                                100% of these fees are credited to your platform upon customer submission.
                            </Text>
                        </View>
                    </View>

                    {/* BOTTOM SAVE BUTTON */}
                    <TouchableOpacity
                        onPress={handleSave}
                        disabled={saving}
                        style={s.bigSaveBtn}
                        activeOpacity={0.85}
                    >
                        <LinearGradient 
                            colors={['#059669', '#047857']} 
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={s.bigSaveGrad}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color={COLORS.white} />
                            ) : (
                                <>
                                    <Ionicons name="save-outline" size={18} color={COLORS.white} />
                                    <Text style={s.bigSaveText}>Save & Apply Pricing Now</Text>
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </ScrollView>
            )}
        </View>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg,
    },
    header: {
        paddingBottom: 14,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerCenter: {
        flex: 1,
        marginLeft: 12,
    },
    badgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginBottom: 2,
    },
    emeraldDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: COLORS.emerald,
    },
    headerBadge: {
        color: '#A7F3D0',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    headerTitle: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '800',
    },
    saveHeaderBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: COLORS.emerald,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 18,
    },
    saveHeaderBtnText: {
        color: COLORS.white,
        fontSize: 12,
        fontWeight: '700',
    },
    scroll: {
        flex: 1,
    },
    content: {
        padding: 16,
        gap: 14,
    },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 10,
        color: COLORS.textSub,
        fontSize: 13,
        fontWeight: '600',
    },
    infoCard: {
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: COLORS.successBorder,
        borderRadius: 14,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
    },
    infoIconBox: {
        width: 34,
        height: 34,
        borderRadius: 8,
        backgroundColor: '#D1FAE5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoTitle: {
        fontSize: 13.5,
        fontWeight: '800',
        color: '#065F46',
        marginBottom: 2,
    },
    infoDesc: {
        fontSize: 11.5,
        color: '#047857',
        lineHeight: 16,
    },
    card: {
        backgroundColor: COLORS.card,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 8,
    },
    iconBox: {
        width: 42,
        height: 42,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: COLORS.navy,
    },
    cardSub: {
        fontSize: 11.5,
        color: COLORS.textSub,
        marginTop: 2,
        fontWeight: '600',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    statusText: {
        fontSize: 9.5,
        fontWeight: '800',
    },
    statusActive: {
        backgroundColor: '#ECFDF5',
    },
    statusActiveText: {
        color: COLORS.emerald,
    },
    statusInactive: {
        backgroundColor: '#FEF2F2',
    },
    statusInactiveText: {
        color: COLORS.danger,
    },
    cardDesc: {
        fontSize: 11.5,
        color: COLORS.textSub,
        lineHeight: 16,
        marginBottom: 12,
    },
    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: COLORS.navySoft,
        marginBottom: 14,
    },
    switchLabel: {
        fontSize: 12.5,
        fontWeight: '700',
        color: COLORS.navyMid,
    },
    switchSub: {
        fontSize: 10.5,
        color: COLORS.textMuted,
        marginTop: 1,
    },
    feeInputGroup: {
        gap: 6,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.navy,
    },
    inputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderWidth: 1.5,
        borderColor: COLORS.emerald,
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 50,
    },
    currencyPrefix: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.emerald,
        marginRight: 6,
    },
    input: {
        flex: 1,
        fontSize: 17,
        fontWeight: '800',
        color: COLORS.navy,
        padding: 0,
    },
    presetsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 10,
    },
    presetLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.textSub,
        marginRight: 2,
    },
    presetPill: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    presetPillActive: {
        backgroundColor: COLORS.emerald,
        borderColor: COLORS.emerald,
    },
    presetPillText: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.textSub,
    },
    presetPillTextActive: {
        color: COLORS.white,
    },
    overviewCard: {
        backgroundColor: COLORS.white,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        gap: 8,
    },
    overviewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 2,
    },
    overviewTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: COLORS.navy,
    },
    overviewRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    overviewLabel: {
        fontSize: 12,
        color: COLORS.textSub,
    },
    overviewValue: {
        fontSize: 13,
        fontWeight: '800',
        color: COLORS.navy,
    },
    overviewDivider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginVertical: 2,
    },
    overviewNote: {
        fontSize: 10.5,
        color: COLORS.textSub,
        flex: 1,
        lineHeight: 14,
    },
    bigSaveBtn: {
        borderRadius: 14,
        overflow: 'hidden',
        marginTop: 6,
        shadowColor: COLORS.emerald,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 3,
    },
    bigSaveGrad: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
    },
    bigSaveText: {
        color: COLORS.white,
        fontSize: 14,
        fontWeight: '800',
    },
});
