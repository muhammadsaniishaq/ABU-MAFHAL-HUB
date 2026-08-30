import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    TextInput,
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Platform,
    RefreshControl,
    StyleSheet,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';

const { width } = Dimensions.get('window');

// Executive Royal Navy & Imperial Gold Palette
const T = {
    bg: '#F8FAFC',
    card: '#FFFFFF',
    cardBorder: '#E2E8F0',
    cardBorderGold: 'rgba(217, 119, 6, 0.28)',
    navyPrimary: '#070D1E',
    navyDeep: '#0A1128',
    navyMid: '#0F172A',
    navyCard: '#1E293B',
    navyLight: '#334155',
    gold: '#D97706',
    goldBright: '#F59E0B',
    goldDark: '#B45309',
    goldLight: '#FEF3C7',
    goldBg: '#FFFBEB',
    goldBorder: '#FDE68A',
    textMain: '#0F172A',
    textSub: '#475569',
    textMuted: '#64748B',
    border: '#CBD5E1',
    inputBg: '#F8FAFC',
    success: '#059669',
    successBg: '#ECFDF5',
    danger: '#DC2626',
    dangerBg: '#FEF2F2',
    warning: '#D97706',
    warningBg: '#FFFBEB',
};

export interface NINServicePrice {
    id: string;
    code: string;
    name: string;
    category: 'slips' | 'validation' | 'modification' | 'ipe' | 'lookup' | 'other';
    description: string;
    cost_price: number;
    markup_price: number;
    status: 'active' | 'maintenance' | 'hidden';
    maintenance_msg?: string;
    icon: string;
}

const OFFICIAL_NIN_CATALOGUE: NINServicePrice[] = [
    {
        id: 'nin_premium',
        code: '101',
        name: 'NIN Premium Slip (HD Colour)',
        category: 'slips',
        description: 'Official full colour biometric card with high-resolution QR.',
        cost_price: 140,
        markup_price: 100,
        status: 'active',
        icon: 'card-outline',
    },
    {
        id: 'nin_standard',
        code: '102',
        name: 'NIN Standard Slip (NIMC Format)',
        category: 'slips',
        description: 'Standard national identity slip with official verification barcode.',
        cost_price: 140,
        markup_price: 60,
        status: 'active',
        icon: 'document-text-outline',
    },
    {
        id: 'nin_regular',
        code: '103',
        name: 'NIN Regular / Compact Slip',
        category: 'slips',
        description: 'Pocket format national ID slip with barcode.',
        cost_price: 140,
        markup_price: 60,
        status: 'active',
        icon: 'receipt-outline',
    },
    {
        id: 'nin_phone',
        code: '104',
        name: 'NIN Lookup by Phone Number',
        category: 'lookup',
        description: 'Instant demographic NIN retrieval using registered phone number.',
        cost_price: 150,
        markup_price: 100,
        status: 'active',
        icon: 'call-outline',
    },
    {
        id: 'nin_verify',
        code: '105',
        name: 'NIN Direct Verification',
        category: 'lookup',
        description: 'Live biometric confirmation and full identity payload lookup.',
        cost_price: 150,
        markup_price: 50,
        status: 'active',
        icon: 'finger-print-outline',
    },
    {
        id: 'vnin_to_nin',
        code: '106',
        name: 'VNIN to Normal NIN Conversion',
        category: 'lookup',
        description: 'Instant conversion of 16-digit Virtual NIN to raw 11-digit NIN.',
        cost_price: 2500,
        markup_price: 500,
        status: 'active',
        icon: 'swap-horizontal-outline',
    },
    {
        id: 'nin_val_norecord',
        code: '201',
        name: 'NIN Validation: No Record Found',
        category: 'validation',
        description: 'Resolution of unindexed records across central NIMC database.',
        cost_price: 1000,
        markup_price: 500,
        status: 'active',
        icon: 'alert-circle-outline',
    },
    {
        id: 'nin_val_update',
        code: '202',
        name: 'NIN Validation: Record Update',
        category: 'validation',
        description: 'Syncing backend NIMC profile with banking NIBSS records.',
        cost_price: 1500,
        markup_price: 500,
        status: 'active',
        icon: 'sync-outline',
    },
    {
        id: 'vnin_val',
        code: '203',
        name: 'Virtual NIN Validation',
        category: 'validation',
        description: 'Validation and authentication of enterprise VNIN tokens.',
        cost_price: 1200,
        markup_price: 300,
        status: 'active',
        icon: 'shield-checkmark-outline',
    },
    {
        id: 'ipe_clearance',
        code: '301',
        name: 'IPE Clearance & Approval',
        category: 'ipe',
        description: 'Instant pre-employment security vetting & IPE verification clearance.',
        cost_price: 450,
        markup_price: 200,
        status: 'active',
        icon: 'briefcase-outline',
    },
    {
        id: 'nin_mod_name',
        code: '401',
        name: 'NIN Modification: Name',
        category: 'modification',
        description: 'Legal update of First, Middle, or Surname on NIMC database.',
        cost_price: 5500,
        markup_price: 1500,
        status: 'active',
        icon: 'person-outline',
    },
    {
        id: 'nin_mod_phone',
        code: '402',
        name: 'NIN Modification: Phone Number',
        category: 'modification',
        description: 'Update of registered MSISDN telephone on NIMC portal.',
        cost_price: 5500,
        markup_price: 1500,
        status: 'active',
        icon: 'phone-portrait-outline',
    },
    {
        id: 'nin_mod_address',
        code: '403',
        name: 'NIN Modification: Address / State',
        category: 'modification',
        description: 'Residential state, LGA, and home address correction.',
        cost_price: 5500,
        markup_price: 1500,
        status: 'active',
        icon: 'home-outline',
    },
    {
        id: 'pers_status',
        code: '501',
        name: 'NIN Personalization Tracking',
        category: 'other',
        description: 'Real-time status check for plastic national ID card issuance.',
        cost_price: 150,
        markup_price: 50,
        status: 'active',
        icon: 'time-outline',
    },
];

export default function EnterpriseNINPricingScreen() {
    const router = useRouter();

    const [services, setServices] = useState<NINServicePrice[]>(OFFICIAL_NIN_CATALOGUE);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);

    // Global NIN Gateway Status Switch
    const [globalNINStatus, setGlobalNINStatus] = useState<'active' | 'maintenance' | 'hidden'>('active');
    const [globalMaintenanceMsg, setGlobalMaintenanceMsg] = useState('NIMC portal infrastructure is currently undergoing scheduled optimization. Services will resume shortly.');

    // Filters
    const [activeTab, setActiveTab] = useState<'all' | 'slips' | 'lookup' | 'validation' | 'ipe' | 'modification'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Modal: Batch Margin Tool
    const [showBatchModal, setShowBatchModal] = useState(false);
    const [batchTargetCategory, setBatchTargetCategory] = useState<'all' | 'slips' | 'validation' | 'modification'>('all');
    const [batchProfitDelta, setBatchProfitDelta] = useState('50');

    useEffect(() => {
        fetchNINPrices();
    }, []);

    const fetchNINPrices = async () => {
        try {
            setLoading(true);

            // 1. Fetch from app_settings ('nin_service_controls')
            const { data: configData } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'nin_service_controls')
                .maybeSingle();

            let savedConfig: any = null;
            if (configData?.value) {
                try {
                    savedConfig = typeof configData.value === 'string' ? JSON.parse(configData.value) : configData.value;
                    if (savedConfig?.global_status) setGlobalNINStatus(savedConfig.global_status);
                    if (savedConfig?.global_maintenance_msg) setGlobalMaintenanceMsg(savedConfig.global_maintenance_msg);
                } catch (e) {
                    console.warn('Error parsing nin_service_controls:', e);
                }
            }

            // 2. Fetch from service_pricing table
            const { data: dbPrices } = await supabase
                .from('service_pricing')
                .select('*')
                .eq('service_category', 'nin');

            const merged: NINServicePrice[] = OFFICIAL_NIN_CATALOGUE.map(def => {
                const dbRow = dbPrices?.find(r => r.id === def.id || (r.name && r.name.toLowerCase() === def.name.toLowerCase()));
                const confRow = savedConfig?.services?.[def.id];

                const cost_price = dbRow?.cost_price !== undefined 
                    ? Number(dbRow.cost_price) 
                    : (confRow?.cost_price !== undefined ? Number(confRow.cost_price) : def.cost_price);

                const markup_price = dbRow?.markup_price !== undefined 
                    ? Number(dbRow.markup_price) 
                    : (confRow?.markup_price !== undefined ? Number(confRow.markup_price) : def.markup_price);

                const status = confRow?.status || (dbRow?.status as any) || def.status || 'active';

                return {
                    ...def,
                    cost_price,
                    markup_price,
                    status,
                    maintenance_msg: confRow?.maintenance_msg || dbRow?.maintenance_msg || undefined,
                };
            });

            setServices(merged);
        } catch (e) {
            console.error('Error fetching NIN pricing:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchNINPrices();
    }, []);

    const handleUpdateServiceField = (id: string, field: 'cost_price' | 'markup_price' | 'status', value: any) => {
        setServices(prev =>
            prev.map(s => {
                if (s.id === id) {
                    return { ...s, [field]: value };
                }
                return s;
            })
        );
    };

    const handleSaveAllNINPrices = async () => {
        setSaving(true);
        try {
            // 1. Build Comprehensive Configuration Object
            const servicesConfig: Record<string, any> = {};
            const hiddenList: string[] = [];
            const maintList: string[] = [];

            services.forEach(s => {
                servicesConfig[s.id] = {
                    id: s.id,
                    code: s.code,
                    name: s.name,
                    category: s.category,
                    cost_price: s.cost_price,
                    markup_price: s.markup_price,
                    selling_price: s.cost_price + s.markup_price,
                    status: s.status,
                    maintenance_msg: s.maintenance_msg,
                };

                if (s.status === 'hidden') hiddenList.push(s.id);
                if (s.status === 'maintenance') maintList.push(s.id);
            });

            const ninMasterConfig = {
                global_status: globalNINStatus,
                global_maintenance_msg: globalMaintenanceMsg,
                services: servicesConfig,
                hidden_services: hiddenList,
                maintenance_services: maintList,
                updated_at: new Date().toISOString(),
            };

            // 2. Persist to app_settings
            const { error: settingsError } = await supabase.from('app_settings').upsert({
                key: 'nin_service_controls',
                value: ninMasterConfig,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'key' });

            if (settingsError) {
                console.warn('app_settings upsert error:', settingsError);
            }

            // 3. Persist to service_pricing rows
            const rowsToUpsert = services.map(s => ({
                id: s.id,
                service_category: 'nin',
                name: s.name,
                cost_price: s.cost_price,
                markup_price: s.markup_price,
                selling_price: s.cost_price + s.markup_price,
                status: s.status,
                updated_at: new Date().toISOString(),
            }));

            try {
                await supabase.from('service_pricing').upsert(rowsToUpsert, { onConflict: 'id' });
            } catch (err) {
                console.warn('service_pricing upsert retry:', err);
                const simplifiedRows = rowsToUpsert.map(({ id, service_category, name, cost_price, markup_price }) => ({
                    id, service_category, name, cost_price, markup_price, updated_at: new Date().toISOString()
                }));
                await supabase.from('service_pricing').upsert(simplifiedRows, { onConflict: 'id' });
            }

            // 4. Try logging to audit_logs safely
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    await supabase.from('audit_logs').insert({
                        admin_id: user.id,
                        action: 'Saved NIN Pricing, Maintenance & Visibility Matrix',
                        target_resource: 'NIN Identity Pricing',
                        details: {
                            globalStatus: globalNINStatus,
                            hiddenCount: hiddenList.length,
                            maintCount: maintList.length,
                        },
                    });
                }
            } catch (e) {
                // Non-critical
            }

            Alert.alert(
                'NIN Controls Saved Live! 🚀',
                `Settings successfully updated:\n• Global Status: ${globalNINStatus.toUpperCase()}\n• Active: ${services.filter(s => s.status === 'active').length}\n• Maintenance: ${maintList.length}\n• Hidden: ${hiddenList.length}`
            );
            fetchNINPrices();
        } catch (e: any) {
            Alert.alert('Save Error', e.message || 'An error occurred while saving.');
        } finally {
            setSaving(false);
        }
    };

    const handleApplyBatchMarkup = () => {
        const delta = parseFloat(batchProfitDelta) || 0;
        if (delta === 0) return;

        setServices(prev =>
            prev.map(s => {
                if (batchTargetCategory === 'all' || s.category === batchTargetCategory) {
                    return {
                        ...s,
                        markup_price: Math.max(0, s.markup_price + delta),
                    };
                }
                return s;
            })
        );

        setShowBatchModal(false);
        Alert.alert(
            'Profit Margin Applied ✨',
            `Added +₦${delta.toLocaleString()} profit margin across ${batchTargetCategory.toUpperCase()} services. Click "Save NIN Pricing & Visibility" to push live.`
        );
    };

    const filteredServices = useMemo(() => {
        return services.filter(s => {
            const matchesCat = activeTab === 'all' || s.category === activeTab;
            const matchesSearch =
                !searchQuery.trim() ||
                s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.description.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesCat && matchesSearch;
        });
    }, [services, activeTab, searchQuery]);

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: 'NIN Pricing & Visibility Control',
                    headerStyle: { backgroundColor: T.navyPrimary },
                    headerTintColor: '#FFFFFF',
                    headerShadowVisible: false,
                    headerRight: () => (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 8 }}>
                            <TouchableOpacity onPress={() => setShowBatchModal(true)} style={styles.headerGoldBtn}>
                                <Ionicons name="calculator-outline" size={17} color={T.goldBright} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={onRefresh} style={styles.headerGoldBtn}>
                                <Ionicons name="refresh" size={17} color={T.goldBright} />
                            </TouchableOpacity>
                        </View>
                    ),
                }}
            />

            {/* Top Telemetry Stat Hero */}
            <LinearGradient colors={[T.navyPrimary, T.navyDeep, T.navyMid]} style={styles.heroSummaryBar}>
                <View style={styles.liveIndicatorRow}>
                    <View style={[styles.pulseDot, globalNINStatus === 'maintenance' ? { backgroundColor: T.goldBright } : globalNINStatus === 'hidden' ? { backgroundColor: T.danger } : { backgroundColor: T.success }]} />
                    <Text style={styles.liveIndicatorText}>
                        NIMC IDENTITY CONTROL • GATEWAY {globalNINStatus.toUpperCase()}
                    </Text>
                </View>

                <View style={styles.summaryGrid}>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryValue}>{services.length}</Text>
                        <Text style={styles.summaryLabel}>Total Items</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                        <Text style={[styles.summaryValue, { color: T.success }]}>
                            {services.filter(s => s.status === 'active').length}
                        </Text>
                        <Text style={styles.summaryLabel}>Active</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                        <Text style={[styles.summaryValue, { color: T.goldBright }]}>
                            {services.filter(s => s.status === 'maintenance').length}
                        </Text>
                        <Text style={styles.summaryLabel}>Maint.</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                        <Text style={[styles.summaryValue, { color: T.danger }]}>
                            {services.filter(s => s.status === 'hidden').length}
                        </Text>
                        <Text style={styles.summaryLabel}>Hidden</Text>
                    </View>
                </View>
            </LinearGradient>

            {/* MASTER GLOBAL NIN GATEWAY CONTROL CARD */}
            <View style={styles.masterControlCard}>
                <View style={styles.masterControlHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="shield-checkmark-outline" size={17} color={T.goldBright} />
                        <Text style={styles.masterControlTitle}>Global NIN Gateway Status</Text>
                    </View>
                    <View style={styles.statusToggleGroup}>
                        {(['active', 'maintenance', 'hidden'] as const).map(st => (
                            <TouchableOpacity
                                key={st}
                                onPress={() => setGlobalNINStatus(st)}
                                style={[
                                    styles.statusTogglePill,
                                    globalNINStatus === st && (st === 'active' ? styles.pillActive : st === 'maintenance' ? styles.pillMaint : styles.pillHide)
                                ]}
                            >
                                <Text style={[
                                    styles.statusTogglePillText,
                                    globalNINStatus === st && { color: '#FFFFFF', fontWeight: '900' }
                                ]}>
                                    {st.toUpperCase()}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {globalNINStatus === 'maintenance' && (
                    <View style={styles.maintMsgBox}>
                        <Text style={styles.maintMsgLabel}>User Downtime Notice:</Text>
                        <TextInput
                            value={globalMaintenanceMsg}
                            onChangeText={setGlobalMaintenanceMsg}
                            placeholder="Enter message displayed to users when NIN services are paused..."
                            placeholderTextColor={T.textMuted}
                            style={styles.maintMsgInput}
                        />
                    </View>
                )}
            </View>

            {/* Sub-Navigation Categories Ribbon */}
            <View style={styles.categoryBar}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
                    {[
                        { key: 'all', label: 'All Services' },
                        { key: 'slips', label: '📄 Slips & Cards' },
                        { key: 'lookup', label: '🔍 Lookups & VNIN' },
                        { key: 'validation', label: '⚡ Validations' },
                        { key: 'ipe', label: '💼 IPE Clearance' },
                        { key: 'modification', label: '🛠️ Modifications' },
                    ].map(cat => (
                        <TouchableOpacity
                            key={cat.key}
                            onPress={() => setActiveTab(cat.key as any)}
                            style={[styles.categoryPill, activeTab === cat.key && styles.categoryPillActive]}
                        >
                            <Text style={[styles.categoryPillText, activeTab === cat.key && styles.categoryPillTextActive]}>
                                {cat.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Search & Action Bar */}
            <View style={styles.searchActionRow}>
                <View style={styles.searchBox}>
                    <Ionicons name="search" size={15} color={T.textMuted} />
                    <TextInput
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Search service name or code (e.g. 101, Premium, IPE)..."
                        placeholderTextColor={T.textMuted}
                        style={styles.searchInput}
                    />
                </View>
                <TouchableOpacity
                    onPress={() => setShowBatchModal(true)}
                    style={styles.batchMarginBtn}
                >
                    <Ionicons name="sparkles" size={14} color={T.goldDark} />
                    <Text style={styles.batchMarginBtnText}>Batch Riba</Text>
                </TouchableOpacity>
            </View>

            {/* NIN Services Pricing List */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={T.gold} />
                    <Text style={styles.loadingText}>Loading NIMC Pricing Engine...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredServices}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.gold} />}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="pricetags-outline" size={40} color={T.gold} />
                            <Text style={styles.emptyStateTitle}>Zero Services Found</Text>
                            <Text style={styles.emptyStateSub}>No NIN services match your current filter.</Text>
                        </View>
                    }
                    renderItem={({ item }) => {
                        const sellingPrice = item.cost_price + item.markup_price;
                        const profitPercent = item.cost_price > 0 ? ((item.markup_price / item.cost_price) * 100).toFixed(1) : '0';

                        return (
                            <View style={styles.serviceCard}>
                                <View style={styles.cardHeader}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                        <View style={styles.iconCircle}>
                                            <Ionicons name={item.icon as any} size={16} color={T.goldBright} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.serviceTitle}>{item.name}</Text>
                                            <Text style={styles.serviceDesc}>{item.description}</Text>
                                        </View>
                                    </View>

                                    {/* Visibility / Status Pill Switcher */}
                                    <View style={styles.itemStatusGroup}>
                                        {(['active', 'maintenance', 'hidden'] as const).map(st => (
                                            <TouchableOpacity
                                                key={st}
                                                onPress={() => handleUpdateServiceField(item.id, 'status', st)}
                                                style={[
                                                    styles.itemStatusPill,
                                                    item.status === st && (st === 'active' ? styles.itemStatusActive : st === 'maintenance' ? styles.itemStatusMaint : styles.itemStatusHide)
                                                ]}
                                            >
                                                <Text style={[
                                                    styles.itemStatusText,
                                                    item.status === st && { color: '#FFFFFF', fontWeight: '900' }
                                                ]}>
                                                    {st === 'active' ? 'Live' : st === 'maintenance' ? 'Maint' : 'Hide'}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                {/* Pricing Breakdown Grid */}
                                <View style={styles.priceBoxesRow}>
                                    {/* 1. API COST PRICE */}
                                    <View style={styles.costBox}>
                                        <Text style={styles.priceBoxLabel}>API COST (NIMC)</Text>
                                        <View style={styles.inputWrap}>
                                            <Text style={styles.nairaSign}>₦</Text>
                                            <TextInput
                                                value={String(item.cost_price)}
                                                onChangeText={val => handleUpdateServiceField(item.id, 'cost_price', parseFloat(val) || 0)}
                                                keyboardType="numeric"
                                                style={styles.priceInput}
                                            />
                                        </View>
                                        <Text style={styles.costSubText}>Code: {item.code}</Text>
                                    </View>

                                    {/* 2. ADMIN PROFIT MARGIN (Riba) */}
                                    <View style={styles.markupBox}>
                                        <Text style={styles.priceBoxLabelMarkup}>PROFIT MARGIN (RIBA)</Text>
                                        <View style={styles.inputWrap}>
                                            <Text style={styles.nairaSignGold}>+₦</Text>
                                            <TextInput
                                                value={String(item.markup_price)}
                                                onChangeText={val => handleUpdateServiceField(item.id, 'markup_price', parseFloat(val) || 0)}
                                                keyboardType="numeric"
                                                style={styles.priceInputGold}
                                            />
                                        </View>
                                        <View style={styles.stepperRow}>
                                            {[-100, -50, 50, 100].map(step => (
                                                <TouchableOpacity
                                                    key={step}
                                                    onPress={() => handleUpdateServiceField(item.id, 'markup_price', Math.max(0, item.markup_price + step))}
                                                    style={styles.stepperBtn}
                                                >
                                                    <Text style={styles.stepperBtnText}>{step > 0 ? `+${step}` : step}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>

                                    {/* 3. USER SELLING PRICE */}
                                    <View style={styles.totalBox}>
                                        <Text style={styles.priceBoxLabelTotal}>USER CHARGE</Text>
                                        <Text style={styles.totalSellingPrice}>₦{sellingPrice.toLocaleString()}</Text>
                                        <View style={styles.marginTag}>
                                            <Text style={styles.marginTagText}>+{profitPercent}%</Text>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        );
                    }}
                />
            )}

            {/* Bottom Save Action Bar */}
            <View style={styles.bottomBar}>
                <TouchableOpacity
                    onPress={handleSaveAllNINPrices}
                    disabled={saving}
                    style={styles.saveLiveBtn}
                    activeOpacity={0.85}
                >
                    {saving ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <>
                            <Ionicons name="checkmark-circle" size={18} color={T.goldBright} />
                            <Text style={styles.saveLiveBtnText}>Save NIN Pricing & Visibility</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            {/* ========================================================================= */}
            {/* MODAL: BATCH PROFIT MARGIN TOOL                                           */}
            {/* ========================================================================= */}
            <Modal
                visible={showBatchModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowBatchModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons name="calculator" size={18} color={T.goldBright} />
                                <Text style={styles.modalTitle}>Batch NIN Profit Margin (Riba)</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowBatchModal(false)}>
                                <Ionicons name="close-circle" size={22} color={T.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalDesc}>
                            Quickly adjust profit margins across all NIN verification services or specific categories.
                        </Text>

                        <Text style={styles.inputLabel}>Target Category</Text>
                        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
                            {[
                                { key: 'all', label: 'All Services' },
                                { key: 'slips', label: 'Slips & Cards' },
                                { key: 'validation', label: 'Validations' },
                                { key: 'modification', label: 'Modifications' },
                            ].map(cat => (
                                <TouchableOpacity
                                    key={cat.key}
                                    onPress={() => setBatchTargetCategory(cat.key as any)}
                                    style={[styles.catPill, batchTargetCategory === cat.key && styles.catPillActive]}
                                >
                                    <Text style={[styles.catPillText, batchTargetCategory === cat.key && styles.catPillTextActive]}>
                                        {cat.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.inputLabel}>Profit Margin Delta (₦ to add to each service)</Text>
                        <TextInput
                            value={batchProfitDelta}
                            onChangeText={setBatchProfitDelta}
                            placeholder="e.g. 50 or 100"
                            placeholderTextColor={T.textMuted}
                            keyboardType="numeric"
                            style={styles.modalInput}
                        />

                        <TouchableOpacity
                            onPress={handleApplyBatchMarkup}
                            style={styles.modalSaveBtn}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.modalSaveBtnText}>Apply Profit Margin</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: T.bg },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 10, fontSize: 12.5, fontWeight: '700', color: T.textSub },
    headerGoldBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: T.navyDeep, borderWidth: 1, borderColor: T.cardBorderGold, alignItems: 'center', justifyContent: 'center' },
    heroSummaryBar: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: T.cardBorderGold },
    liveIndicatorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    pulseDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: T.success },
    liveIndicatorText: { fontSize: 9.5, fontWeight: '900', color: T.goldBright, letterSpacing: 1 },
    summaryGrid: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: 'rgba(217, 119, 6, 0.2)' },
    summaryItem: { alignItems: 'center', flex: 1 },
    summaryValue: { fontSize: 15, fontWeight: '900', color: '#FFFFFF' },
    summaryLabel: { fontSize: 9.5, color: '#94A3B8', fontWeight: '700', marginTop: 1 },
    summaryDivider: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.1)' },
    masterControlCard: { backgroundColor: '#FFFFFF', marginHorizontal: 12, marginTop: 8, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: T.cardBorderGold },
    masterControlHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    masterControlTitle: { fontSize: 11.5, fontWeight: '900', color: T.navyPrimary },
    statusToggleGroup: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 6, padding: 2, gap: 2 },
    statusTogglePill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5 },
    pillActive: { backgroundColor: '#059669' },
    pillMaint: { backgroundColor: '#D97706' },
    pillHide: { backgroundColor: '#DC2626' },
    statusTogglePillText: { fontSize: 9, fontWeight: '700', color: '#64748B' },
    maintMsgBox: { marginTop: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 6 },
    maintMsgLabel: { fontSize: 9.5, fontWeight: '800', color: T.goldDark, marginBottom: 2 },
    maintMsgInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: T.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, fontSize: 11, color: T.textMain },
    categoryBar: { backgroundColor: T.navyPrimary, borderBottomWidth: 1, borderBottomColor: 'rgba(217, 119, 6, 0.2)', paddingVertical: 6, marginTop: 8 },
    categoryScroll: { paddingHorizontal: 10, gap: 6 },
    categoryPill: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 14, backgroundColor: T.navyDeep },
    categoryPillActive: { backgroundColor: T.navyCard, borderWidth: 1, borderColor: T.gold },
    categoryPillText: { fontSize: 10.5, fontWeight: '700', color: T.textMuted },
    categoryPillTextActive: { color: T.goldBright, fontWeight: '900' },
    searchActionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 8, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: T.cardBorder },
    searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: T.inputBg, borderWidth: 1, borderColor: T.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, gap: 6 },
    searchInput: { flex: 1, fontSize: 11.5, color: T.textMain },
    batchMarginBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: T.goldBg, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: T.goldBorder },
    batchMarginBtnText: { fontSize: 11, fontWeight: '800', color: T.goldDark },
    listContent: { padding: 12, paddingBottom: 90 },
    serviceCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: T.cardBorder, elevation: 1 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
    iconCircle: { width: 32, height: 32, borderRadius: 8, backgroundColor: T.navyPrimary, alignItems: 'center', justifyContent: 'center' },
    serviceTitle: { fontSize: 13.5, fontWeight: '900', color: T.navyPrimary },
    serviceDesc: { fontSize: 10, color: T.textMuted, marginTop: 1, lineHeight: 13 },
    itemStatusGroup: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 5, padding: 2, gap: 2 },
    itemStatusPill: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
    itemStatusActive: { backgroundColor: '#059669' },
    itemStatusMaint: { backgroundColor: '#D97706' },
    itemStatusHide: { backgroundColor: '#DC2626' },
    itemStatusText: { fontSize: 8.5, fontWeight: '700', color: '#64748B' },
    priceBoxesRow: { flexDirection: 'row', gap: 6 },
    costBox: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#E2E8F0' },
    markupBox: { flex: 1.3, backgroundColor: '#FFFBEB', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#FDE68A' },
    totalBox: { flex: 1.1, backgroundColor: T.navyPrimary, borderRadius: 8, padding: 8, alignItems: 'center', justifyContent: 'center' },
    priceBoxLabel: { fontSize: 7.5, fontWeight: '900', color: T.textMuted, marginBottom: 3 },
    priceBoxLabelMarkup: { fontSize: 7.5, fontWeight: '900', color: T.goldDark, marginBottom: 3 },
    priceBoxLabelTotal: { fontSize: 7.5, fontWeight: '900', color: '#94A3B8', marginBottom: 2 },
    inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: T.border, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 3 },
    nairaSign: { fontSize: 11.5, fontWeight: '800', color: T.textSub, marginRight: 2 },
    nairaSignGold: { fontSize: 11.5, fontWeight: '900', color: T.goldDark, marginRight: 2 },
    priceInput: { flex: 1, fontSize: 12, fontWeight: '800', color: T.navyPrimary, padding: 0 },
    priceInputGold: { flex: 1, fontSize: 12, fontWeight: '900', color: T.goldDark, padding: 0 },
    costSubText: { fontSize: 8, color: T.textMuted, marginTop: 3 },
    stepperRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, gap: 2 },
    stepperBtn: { flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 3, paddingVertical: 2, alignItems: 'center' },
    stepperBtnText: { fontSize: 7.5, fontWeight: '800', color: T.goldDark },
    totalSellingPrice: { fontSize: 14, fontWeight: '900', color: '#FFFFFF', marginVertical: 1 },
    marginTag: { backgroundColor: 'rgba(52, 211, 153, 0.2)', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3 },
    marginTagText: { fontSize: 7.5, fontWeight: '900', color: '#34D399' },
    bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: T.cardBorder },
    saveLiveBtn: { backgroundColor: T.navyPrimary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 10, gap: 6, borderWidth: 1, borderColor: T.cardBorderGold },
    saveLiveBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
    emptyState: { padding: 28, alignItems: 'center' },
    emptyStateTitle: { fontSize: 13.5, fontWeight: '900', color: T.navyPrimary, marginTop: 6 },
    emptyStateSub: { fontSize: 10.5, color: T.textMuted, marginTop: 2 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(7, 13, 30, 0.65)', justifyContent: 'flex-end' },
    modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, maxHeight: '80%', borderWidth: 1, borderColor: T.cardBorderGold },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    modalTitle: { fontSize: 14.5, fontWeight: '900', color: T.navyPrimary },
    modalDesc: { fontSize: 11, color: T.textSub, lineHeight: 15, marginBottom: 12 },
    inputLabel: { fontSize: 11, fontWeight: '800', color: T.navyPrimary, marginTop: 6, marginBottom: 4 },
    modalInput: { backgroundColor: T.inputBg, borderWidth: 1, borderColor: T.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, fontSize: 12, color: T.textMain, marginBottom: 8 },
    catPill: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 6, backgroundColor: '#F1F5F9' },
    catPillActive: { backgroundColor: T.navyPrimary },
    catPillText: { fontSize: 10, fontWeight: '700', color: T.textSub },
    catPillTextActive: { color: T.goldBright, fontWeight: '900' },
    modalSaveBtn: { backgroundColor: T.navyPrimary, paddingVertical: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: T.cardBorderGold, marginTop: 10, marginBottom: 16 },
    modalSaveBtnText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '900' },
});
