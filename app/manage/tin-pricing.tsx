import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
    Dimensions,
    Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';

const { width } = Dimensions.get('window');

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
    borderFocus: '#CBD5E1',
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
    white: '#FFFFFF',
};

export interface TinPricingItem {
    id: 'tin_certificate' | 'tin_registration';
    title: string;
    subtitle: string;
    description: string;
    cost_price: number;
    selling_price: number;
    is_active: boolean;
    category: 'retrieval' | 'registration';
    icon: string;
}

const DEFAULT_TIN_PRICING: Record<'tin_certificate' | 'tin_registration', TinPricingItem> = {
    tin_certificate: {
        id: 'tin_certificate',
        title: 'Tax ID Certificate Retrieval',
        subtitle: 'Binciko & Saukar da Certificate',
        description: 'Official JTB / JRB Tax ID Certificate search by NIN, Tax ID, CAC Number, or Registered Name.',
        cost_price: 1000,
        selling_price: 1500,
        is_active: true,
        category: 'retrieval',
        icon: 'document-text',
    },
    tin_registration: {
        id: 'tin_registration',
        title: 'New TIN Registration',
        subtitle: 'Rijistar Sabuwar Lambar Haraji',
        description: 'New Individual or Non-Individual (Business) Joint Tax Board Tax ID Registration.',
        cost_price: 1800,
        selling_price: 2500,
        is_active: true,
        category: 'registration',
        icon: 'person-add',
    },
};

export default function TinPricingManagement() {
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);

    // State
    const [prices, setPrices] = useState<Record<'tin_certificate' | 'tin_registration', TinPricingItem>>({
        ...DEFAULT_TIN_PRICING,
    });
    const [costInputs, setCostInputs] = useState<Record<string, string>>({
        tin_certificate: '1000',
        tin_registration: '1800',
    });
    const [sellInputs, setSellInputs] = useState<Record<string, string>>({
        tin_certificate: '1500',
        tin_registration: '2500',
    });
    const [statusInputs, setStatusInputs] = useState<Record<string, boolean>>({
        tin_certificate: true,
        tin_registration: true,
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
                .eq('key', 'tin_pricing_controls')
                .maybeSingle();

            let loadedPrices = { ...DEFAULT_TIN_PRICING };

            if (settingsData && settingsData.value) {
                try {
                    const parsed = typeof settingsData.value === 'string' ? JSON.parse(settingsData.value) : settingsData.value;
                    if (parsed && typeof parsed === 'object') {
                        loadedPrices = { ...loadedPrices, ...parsed };
                    }
                } catch (_) {}
            } else {
                // 2. Fallback to service_pricing table
                const { data: spRows } = await supabase
                    .from('service_pricing')
                    .select('id, cost_price, markup_price, is_active')
                    .in('id', ['tin_certificate', 'tin_registration']);

                if (spRows && spRows.length > 0) {
                    spRows.forEach((r: any) => {
                        const k = r.id as 'tin_certificate' | 'tin_registration';
                        if (loadedPrices[k]) {
                            const cost = Number(r.cost_price || 0);
                            const markup = Number(r.markup_price || 0);
                            loadedPrices[k].cost_price = cost;
                            loadedPrices[k].selling_price = cost + markup;
                            if (typeof r.is_active === 'boolean') {
                                loadedPrices[k].is_active = r.is_active;
                            }
                        }
                    });
                }
            }

            setPrices(loadedPrices);
            setCostInputs({
                tin_certificate: String(loadedPrices.tin_certificate.cost_price),
                tin_registration: String(loadedPrices.tin_registration.cost_price),
            });
            setSellInputs({
                tin_certificate: String(loadedPrices.tin_certificate.selling_price),
                tin_registration: String(loadedPrices.tin_registration.selling_price),
            });
            setStatusInputs({
                tin_certificate: loadedPrices.tin_certificate.is_active !== false,
                tin_registration: loadedPrices.tin_registration.is_active !== false,
            });
        } catch (e) {
            console.warn('Error loading TIN pricing:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleSave = async () => {
        const certCost = parseFloat(costInputs.tin_certificate) || 0;
        const certSell = parseFloat(sellInputs.tin_certificate) || 0;
        const regCost = parseFloat(costInputs.tin_registration) || 0;
        const regSell = parseFloat(sellInputs.tin_registration) || 0;

        if (certSell < 0 || regSell < 0) {
            return Alert.alert('Invalid Price', 'Farashin da kuka shigar ba zai iya zama ƙasa da sifili ba.');
        }

        if (certSell < certCost) {
            return Alert.alert('Warning / Gargadi', 'Farashin siyar da Certificate ya yi ƙasa da asalin cost price ɗinku!');
        }

        if (regSell < regCost) {
            return Alert.alert('Warning / Gargadi', 'Farashin sabuwar rajistar TIN ya yi ƙasa da asalin cost price ɗinku!');
        }

        setSaving(true);
        try {
            const updatedPricing = {
                tin_certificate: {
                    ...prices.tin_certificate,
                    cost_price: certCost,
                    selling_price: certSell,
                    is_active: statusInputs.tin_certificate,
                },
                tin_registration: {
                    ...prices.tin_registration,
                    cost_price: regCost,
                    selling_price: regSell,
                    is_active: statusInputs.tin_registration,
                },
            };

            // 1. Save to app_settings
            const now = new Date().toISOString();
            await supabase.from('app_settings').upsert([
                {
                    key: 'tin_pricing_controls',
                    value: updatedPricing,
                    updated_at: now,
                },
                {
                    key: 'price_tin_certificate',
                    value: String(certSell),
                    updated_at: now,
                },
                {
                    key: 'price_tin_registration',
                    value: String(regSell),
                    updated_at: now,
                },
            ], { onConflict: 'key' });

            // 2. Also upsert into service_pricing table
            const markupCert = Math.max(0, certSell - certCost);
            const markupReg = Math.max(0, regSell - regCost);

            try {
                await supabase.from('service_pricing').upsert([
                    {
                        id: 'tin_certificate',
                        service_name: 'Tax ID Certificate Retrieval',
                        cost_price: certCost,
                        markup_price: markupCert,
                        is_active: statusInputs.tin_certificate,
                    },
                    {
                        id: 'tin_registration',
                        service_name: 'New TIN Registration',
                        cost_price: regCost,
                        markup_price: markupReg,
                        is_active: statusInputs.tin_registration,
                    },
                ], { onConflict: 'id' });
            } catch (spErr) {
                console.warn('service_pricing sync optional note:', spErr);
            }

            // 3. Log into audit_logs if available
            try {
                const { data: authData } = await supabase.auth.getUser();
                if (authData?.user) {
                    await supabase.from('audit_logs').insert({
                        admin_id: authData.user.id,
                        action: 'Updated TIN Pricing & Profit Margins',
                        target_resource: 'TIN / Tax ID Pricing',
                        details: {
                            certificatePrice: certSell,
                            certificateProfit: markupCert,
                            registrationPrice: regSell,
                            registrationProfit: markupReg,
                            timestamp: now,
                        },
                    });
                }
            } catch (_) {}

            setPrices(updatedPricing);
            Alert.alert('Nasarar Adanawa! 🎉', 'An adana sabon farashin TIN da na Certificate cikin nasara. Yanzu zai yi aiki a manhaja da bot.');
        } catch (err: any) {
            Alert.alert('Kuskure', err?.message || 'An samu matsala wajen adana farashin.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <View style={s.container}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* HEADER */}
            <LinearGradient colors={[COLORS.navyDark, COLORS.navy]} style={s.header}>
                <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
                    <Ionicons name="arrow-back" size={20} color={COLORS.white} />
                </TouchableOpacity>

                <View style={s.headerCenter}>
                    <View style={s.badgeRow}>
                        <View style={s.emeraldDot} />
                        <Text style={s.headerBadge}>JTB TAX SERVICES PRICING</Text>
                    </View>
                    <Text style={s.headerTitle}>Seta Farashin TIN & Certificate</Text>
                </View>

                <TouchableOpacity
                    onPress={handleSave}
                    disabled={saving || loading}
                    style={[s.saveHeaderBtn, saving && { opacity: 0.7 }]}
                >
                    {saving ? (
                        <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                        <>
                            <Ionicons name="checkmark-circle" size={16} color={COLORS.white} />
                            <Text style={s.saveHeaderBtnText}>Adana</Text>
                        </>
                    )}
                </TouchableOpacity>
            </LinearGradient>

            {loading ? (
                <View style={s.centered}>
                    <ActivityIndicator size="large" color={COLORS.emerald} />
                    <Text style={s.loadingText}>Ina dakko farashin TIN...</Text>
                </View>
            ) : (
                <ScrollView
                    style={s.scroll}
                    contentContainerStyle={s.content}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPricing(); }} />}
                >
                    {/* INFO BANNER */}
                    <View style={s.infoCard}>
                        <View style={s.infoIconBox}>
                            <Ionicons name="shield-checkmark" size={20} color={COLORS.emerald} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={s.infoTitle}>Ikon Sarrafa Farashi & Riba</Text>
                            <Text style={s.infoDesc}>
                                Dukkan farashin da ka seta a nan shi ne manhaja da WhatsApp Bot za su caje customer. Biyan kuɗi yana sauka a asusunka kai tsaye.
                            </Text>
                        </View>
                    </View>

                    {/* ITEM 1: TAX ID CERTIFICATE RETRIEVAL */}
                    <View style={s.card}>
                        <View style={s.cardHeader}>
                            <View style={[s.iconBox, { backgroundColor: '#ECFDF5' }]}>
                                <Ionicons name="document-text" size={20} color={COLORS.emerald} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <View style={s.titleRow}>
                                    <Text style={s.cardTitle}>Tax ID Certificate Retrieval</Text>
                                    <View style={[s.statusBadge, statusInputs.tin_certificate ? s.statusActive : s.statusInactive]}>
                                        <Text style={[s.statusText, statusInputs.tin_certificate ? s.statusActiveText : s.statusInactiveText]}>
                                            {statusInputs.tin_certificate ? 'A KUNNE' : 'A KASHE'}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={s.cardSub}>Binciko & Saukar da Takardar Shaidar Haraji</Text>
                            </View>
                        </View>

                        <Text style={s.cardDesc}>
                            Customer zai bayar da NIN, Tax ID, CAC Number, ko Sunan Kamfani don a ciro masa official certificate na JTB.
                        </Text>

                        {/* TOGGLE SWITCH */}
                        <View style={s.switchRow}>
                            <Text style={s.switchLabel}>Kunna Sabis ɗin a Manhaja:</Text>
                            <Switch
                                value={statusInputs.tin_certificate}
                                onValueChange={(v) => setStatusInputs(prev => ({ ...prev, tin_certificate: v }))}
                                trackColor={{ false: '#E2E8F0', true: COLORS.successBorder }}
                                thumbColor={statusInputs.tin_certificate ? COLORS.emerald : '#94A3B8'}
                            />
                        </View>

                        {/* PRICE INPUTS ROW */}
                        <View style={s.inputsGrid}>
                            <View style={s.inputCol}>
                                <Text style={s.inputLabel}>Cost Price (Kuɗin da kake kashewa):</Text>
                                <View style={s.inputWrap}>
                                    <Text style={s.currencyPrefix}>₦</Text>
                                    <TextInput
                                        style={s.input}
                                        keyboardType="numeric"
                                        value={costInputs.tin_certificate}
                                        onChangeText={(t) => setCostInputs(prev => ({ ...prev, tin_certificate: t }))}
                                        placeholder="1000"
                                    />
                                </View>
                            </View>

                            <View style={s.inputCol}>
                                <Text style={s.inputLabel}>Selling Price (Farashin da Customer ke biya):</Text>
                                <View style={[s.inputWrap, s.inputWrapActive]}>
                                    <Text style={[s.currencyPrefix, { color: COLORS.emerald }]}>₦</Text>
                                    <TextInput
                                        style={[s.input, { fontWeight: '800', color: COLORS.emerald }]}
                                        keyboardType="numeric"
                                        value={sellInputs.tin_certificate}
                                        onChangeText={(t) => setSellInputs(prev => ({ ...prev, tin_certificate: t }))}
                                        placeholder="1500"
                                    />
                                </View>
                            </View>
                        </View>

                        {/* PROFIT SUMMARY BADGE */}
                        <View style={s.profitBox}>
                            <Ionicons name="trending-up" size={15} color={COLORS.emerald} />
                            <Text style={s.profitText}>
                                Riba ga kowane aiki (Profit Margin):{' '}
                                <Text style={s.profitAmount}>
                                    ₦{Math.max(0, (parseFloat(sellInputs.tin_certificate) || 0) - (parseFloat(costInputs.tin_certificate) || 0)).toLocaleString()}
                                </Text>
                            </Text>
                        </View>
                    </View>

                    {/* ITEM 2: NEW TIN REGISTRATION */}
                    <View style={s.card}>
                        <View style={s.cardHeader}>
                            <View style={[s.iconBox, { backgroundColor: '#EFF6FF' }]}>
                                <Ionicons name="person-add" size={20} color="#2563EB" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <View style={s.titleRow}>
                                    <Text style={s.cardTitle}>New TIN Registration</Text>
                                    <View style={[s.statusBadge, statusInputs.tin_registration ? s.statusActive : s.statusInactive]}>
                                        <Text style={[s.statusText, statusInputs.tin_registration ? s.statusActiveText : s.statusInactiveText]}>
                                            {statusInputs.tin_registration ? 'A KUNNE' : 'A KASHE'}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={s.cardSub}>Rijistar Sabuwar Lambar Haraji ta TIN</Text>
                            </View>
                        </View>

                        <Text style={s.cardDesc}>
                            Rijistar sabon Tax ID ga mutum (Individual) ko kamfani (Business/Enterprise) a hukumar JTB.
                        </Text>

                        {/* TOGGLE SWITCH */}
                        <View style={s.switchRow}>
                            <Text style={s.switchLabel}>Kunna Sabis ɗin a Manhaja:</Text>
                            <Switch
                                value={statusInputs.tin_registration}
                                onValueChange={(v) => setStatusInputs(prev => ({ ...prev, tin_registration: v }))}
                                trackColor={{ false: '#E2E8F0', true: COLORS.successBorder }}
                                thumbColor={statusInputs.tin_registration ? COLORS.emerald : '#94A3B8'}
                            />
                        </View>

                        {/* PRICE INPUTS ROW */}
                        <View style={s.inputsGrid}>
                            <View style={s.inputCol}>
                                <Text style={s.inputLabel}>Cost Price (Kuɗin da kake kashewa):</Text>
                                <View style={s.inputWrap}>
                                    <Text style={s.currencyPrefix}>₦</Text>
                                    <TextInput
                                        style={s.input}
                                        keyboardType="numeric"
                                        value={costInputs.tin_registration}
                                        onChangeText={(t) => setCostInputs(prev => ({ ...prev, tin_registration: t }))}
                                        placeholder="1800"
                                    />
                                </View>
                            </View>

                            <View style={s.inputCol}>
                                <Text style={s.inputLabel}>Selling Price (Farashin da Customer ke biya):</Text>
                                <View style={[s.inputWrap, s.inputWrapActive]}>
                                    <Text style={[s.currencyPrefix, { color: COLORS.emerald }]}>₦</Text>
                                    <TextInput
                                        style={[s.input, { fontWeight: '800', color: COLORS.emerald }]}
                                        keyboardType="numeric"
                                        value={sellInputs.tin_registration}
                                        onChangeText={(t) => setSellInputs(prev => ({ ...prev, tin_registration: t }))}
                                        placeholder="2500"
                                    />
                                </View>
                            </View>
                        </View>

                        {/* PROFIT SUMMARY BADGE */}
                        <View style={s.profitBox}>
                            <Ionicons name="trending-up" size={15} color={COLORS.emerald} />
                            <Text style={s.profitText}>
                                Riba ga kowane aiki (Profit Margin):{' '}
                                <Text style={s.profitAmount}>
                                    ₦{Math.max(0, (parseFloat(sellInputs.tin_registration) || 0) - (parseFloat(costInputs.tin_registration) || 0)).toLocaleString()}
                                </Text>
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
                        <LinearGradient colors={['#059669', '#047857']} style={s.bigSaveGrad}>
                            {saving ? (
                                <ActivityIndicator size="small" color={COLORS.white} />
                            ) : (
                                <>
                                    <Ionicons name="save-outline" size={18} color={COLORS.white} />
                                    <Text style={s.bigSaveText}>Ajiye & Kunna Farashin Yanzu</Text>
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
        paddingTop: Platform.OS === 'ios' ? 48 : 36,
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
        fontSize: 15,
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
        paddingBottom: 40,
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
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#D1FAE5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoTitle: {
        fontSize: 13,
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
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    cardTitle: {
        fontSize: 14.5,
        fontWeight: '800',
        color: COLORS.navy,
    },
    cardSub: {
        fontSize: 11.5,
        color: COLORS.textSub,
        marginTop: 2,
    },
    statusBadge: {
        paddingHorizontal: 7,
        paddingVertical: 2,
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
        fontSize: 9.5,
        fontWeight: '800',
    },
    statusInactive: {
        backgroundColor: '#FEF2F2',
    },
    statusInactiveText: {
        color: COLORS.danger,
        fontSize: 9.5,
        fontWeight: '800',
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
        paddingVertical: 8,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: COLORS.navySoft,
        marginBottom: 12,
    },
    switchLabel: {
        fontSize: 12.5,
        fontWeight: '600',
        color: COLORS.navyMid,
    },
    inputsGrid: {
        gap: 10,
    },
    inputCol: {
        gap: 4,
    },
    inputLabel: {
        fontSize: 11.5,
        fontWeight: '700',
        color: COLORS.textSub,
    },
    inputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.bg,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 10,
        paddingHorizontal: 10,
    },
    inputWrapActive: {
        borderColor: COLORS.emerald,
        backgroundColor: '#F0FDF4',
    },
    currencyPrefix: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.textSub,
        marginRight: 6,
    },
    input: {
        flex: 1,
        paddingVertical: 9,
        fontSize: 14.5,
        color: COLORS.navy,
    },
    profitBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#ECFDF5',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 7,
        marginTop: 12,
    },
    profitText: {
        fontSize: 11.5,
        color: '#065F46',
        fontWeight: '600',
    },
    profitAmount: {
        fontWeight: '800',
        color: COLORS.emerald,
    },
    bigSaveBtn: {
        borderRadius: 14,
        overflow: 'hidden',
        marginTop: 6,
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

