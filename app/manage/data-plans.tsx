import { 
    View, 
    Text, 
    ScrollView, 
    TouchableOpacity, 
    TextInput, 
    ActivityIndicator, 
    Alert, 
    Modal, 
    Platform, 
    Switch 
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../services/supabase';

// Executive Light Theme Palette (Clean White, Gold & Royal Navy)
const L = {
    bg: '#F4F6FB',
    card: '#FFFFFF',
    cardBorder: 'rgba(245, 158, 11, 0.4)',
    navyHeader: '#0F172A',
    navyMid: '#1E293B',
    gold: '#F59E0B',
    goldDk: '#D97706',
    goldBg: '#FEF3C7',
    goldBorder: '#FDE047',
    textPrimary: '#0F172A',
    textSecondary: '#334155',
    textMuted: '#64748B',
    inputBg: '#F8FAFC',
    inputBorder: '#E2E8F0',
    emerald: '#10B981',
    emeraldBg: '#D1FAE5',
    emeraldBorder: '#A7F3D0',
    blue: '#3B82F6',
    blueBg: '#DBEAFE',
    rose: '#EF4444',
    roseBg: '#FEE2E2'
};

const VENDORS = [
    { id: 'all', name: 'All Vendors', color: '#64748B', bg: '#F1F5F9' },
    { id: 'clubkonnect', name: 'ClubKonnect', color: '#2563EB', bg: '#DBEAFE' },
    { id: 'bigi', name: 'Bigi VTU', color: '#4F46E5', bg: '#E0E7FF' },
    { id: 'bilalsadasub', name: 'BilalSadaSub', color: '#059669', bg: '#D1FAE5' },
];

export default function ManageDataPlans() {
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [plans, setPlans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [selectedNetwork, setSelectedNetwork] = useState('mtn');
    const [selectedVendorFilter, setSelectedVendorFilter] = useState('all');
    const [selectedPlanTypeFilter, setSelectedPlanTypeFilter] = useState('all');
    
    // Custom Plan Types List
    const [planTypesList, setPlanTypesList] = useState<string[]>(['SME', 'CG', 'Gifting', 'Direct', 'Special']);
    const [showAddTypeModal, setShowAddTypeModal] = useState(false);
    const [newCustomTypeName, setNewCustomTypeName] = useState('');

    // Edit Modal States
    const [editingPlan, setEditingPlan] = useState<any | null>(null);
    const [newPrice, setNewPrice] = useState('');
    const [selectedPlanType, setSelectedPlanType] = useState('SME');
    const [customTypeInput, setCustomTypeInput] = useState('');
    const [activeVendor, setActiveVendor] = useState('clubkonnect');

    // Alert Modal State
    const [alertModal, setAlertModal] = useState<{ visible: boolean; title: string; message: string; type: 'success' | 'error' }>({
        visible: false,
        title: '',
        message: '',
        type: 'success'
    });

    const showAlert = (title: string, message: string, type: 'success' | 'error' = 'success') => {
        setAlertModal({ visible: true, title, message, type });
        if (Platform.OS === 'web') {
            try { window.alert(`${title}\n\n${message}`); } catch (_) {}
        } else {
            Alert.alert(title, message);
        }
    };

    // Detailed Sync Report Modal State
    const [syncResultModal, setSyncResultModal] = useState<{
        visible: boolean;
        total: number;
        vendorBreakdown: Record<string, {
            name: string;
            total: number;
            networks: Record<string, number>;
            plans: any[];
        }>;
        selectedVendorTab: string;
    }>({
        visible: false,
        total: 0,
        vendorBreakdown: {},
        selectedVendorTab: 'bilalsadasub'
    });

    // Markup Configs
    const [configs, setConfigs] = useState<any[]>([]);
    const [editingConfig, setEditingConfig] = useState<any | null>(null);
    const [newMarkupValue, setNewMarkupValue] = useState('');
    const [newMarkupType, setNewMarkupType] = useState<'fixed' | 'percentage'>('fixed');
    const [applyingMarkups, setApplyingMarkups] = useState(false);

    const networks = ['mtn', 'glo', 'airtel', '9mobile', 'vital'];

    useEffect(() => {
        fetchConfigsAndPlanTypes();
    }, []);

    useEffect(() => {
        fetchPlans();
    }, [selectedNetwork, selectedVendorFilter, selectedPlanTypeFilter]);

    const fetchConfigsAndPlanTypes = async () => {
        try {
            // 1. Fetch Active VTU Vendor
            const { data: vendorData } = await supabase.from('app_settings').select('value').eq('key', 'vtu_vendor').single();
            if (vendorData && vendorData.value) {
                const v = typeof vendorData.value === 'object' ? vendorData.value.vendor || vendorData.value : vendorData.value;
                setActiveVendor(String(v).toLowerCase());
            }

            // 2. Fetch Custom Plan Types from app_settings & system_secrets
            let loadedTypes: string[] = [];
            const { data: typesData } = await supabase.from('app_settings').select('value').eq('key', 'data_plan_types').maybeSingle();
            if (typesData && typesData.value) {
                if (Array.isArray(typesData.value)) loadedTypes = typesData.value;
                else if (typeof typesData.value === 'string') {
                    try { loadedTypes = JSON.parse(typesData.value); } catch (_) {}
                }
            }
            if (loadedTypes.length === 0) {
                const { data: secData } = await supabase.from('system_secrets').select('value').eq('key', 'DATA_PLAN_TYPES').maybeSingle();
                if (secData && secData.value) {
                    try { loadedTypes = JSON.parse(secData.value); } catch (_) {}
                }
            }
            const baseTypes = ['SME', 'CG', 'GIFTING', 'PROMO', 'DIRECT', 'MEGA', 'NIGHT', 'COUPON'];
            const mergedTypes = Array.from(new Set([...baseTypes, ...loadedTypes]));
            setPlanTypesList(mergedTypes);

            // 3. Fetch Network Markup Configs
            const { data, error } = await supabase
                .from('data_configs')
                .select('*')
                .order('network', { ascending: true });
            if (error) throw error;
            if (data) setConfigs(data);
        } catch (e: any) {
            console.error("Error fetching configs:", e.message);
        }
    };

    const fetchPlans = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('data_plans')
                .select('*')
                .order('cost_price', { ascending: true });

            if (selectedNetwork === 'vitel' || selectedNetwork === 'vital') {
                query = query.or('network.ilike.vitel,network.ilike.vital,network.eq.vitel,network.eq.vital');
            } else {
                query = query.ilike('network', selectedNetwork);
            }

            const { data, error } = await query;
            let resultPlans = data || [];

            // Vendor Filter (Soft filter - retain plans if no match)
            if (selectedVendorFilter === 'bilalsadasub') {
                const filtered = resultPlans.filter(p => p.api_vendor === 'bilalsadasub' || p.name?.toLowerCase().includes('bilal'));
                if (filtered.length > 0) resultPlans = filtered;
            } else if (selectedVendorFilter === 'bigi') {
                const filtered = resultPlans.filter(p => p.api_vendor === 'bigi' || p.name?.toLowerCase().includes('bigi'));
                if (filtered.length > 0) resultPlans = filtered;
            } else if (selectedVendorFilter === 'clubkonnect') {
                const filtered = resultPlans.filter(p => p.api_vendor === 'clubkonnect' || (!p.name?.toLowerCase().includes('bilal') && !p.name?.toLowerCase().includes('bigi')));
                if (filtered.length > 0) resultPlans = filtered;
            }

            // Plan Type Filter
            if (selectedPlanTypeFilter !== 'all') {
                resultPlans = resultPlans.filter(p => {
                    const pt = (p.plan_type || p.name || '').toUpperCase();
                    const filter = selectedPlanTypeFilter.toUpperCase();
                    if (filter === 'CG') return pt.includes('CG') || pt.includes('CORPORATE');
                    if (filter === 'GIFTING') return pt.includes('GIFT') || pt.includes('DIRECT');
                    return pt.includes(filter);
                });
            }

            setPlans(resultPlans);
        } catch (error: any) {
            showAlert('Data Error', error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateNewPlanType = async () => {
        const cleanName = newCustomTypeName.trim().toUpperCase();
        if (!cleanName) {
            showAlert('Input Error', 'Please enter a valid Plan Type name.', 'error');
            return;
        }

        if (planTypesList.includes(cleanName)) {
            showAlert('Notice', `Plan Type "${cleanName}" already exists.`, 'error');
            return;
        }

        const updatedList = Array.from(new Set([...planTypesList, cleanName]));
        setPlanTypesList(updatedList);
        setNewCustomTypeName('');
        setShowAddTypeModal(false);

        try {
            const { error: appErr } = await supabase
                .from('app_settings')
                .upsert({ key: 'data_plan_types', value: updatedList }, { onConflict: 'key' });

            const { error: secErr } = await supabase
                .from('system_secrets')
                .upsert({ key: 'DATA_PLAN_TYPES', value: JSON.stringify(updatedList) }, { onConflict: 'key' });

            if (appErr && secErr) throw appErr || secErr;
            showAlert('Plan Type Added 🎉', `New Plan Type "${cleanName}" added & saved permanently. It will remain active even after refresh.`);
        } catch (e: any) {
            showAlert('Saved to Memory', `Plan Type added to current session. (${e.message})`);
        }
    };

    const handleSync = async (vendorId: string = 'all') => {
        setSyncing(true);
        try {
            const { data, error } = await supabase.functions.invoke('sync-plans', {
                body: { vendor: vendorId }
            });

            if (error) throw error;

            if (data && data.success) {
                const breakdown = data.vendorBreakdown || {};
                const availableVendors = Object.keys(breakdown);
                const defaultVendor = availableVendors.includes(vendorId) ? vendorId : (availableVendors[0] || 'bilalsadasub');

                setSyncResultModal({
                    visible: true,
                    total: data.total || 0,
                    vendorBreakdown: breakdown,
                    selectedVendorTab: defaultVendor
                });
                fetchPlans();
            } else {
                showAlert('Sync Complete 🎉', data?.message || `Data plans updated successfully.`);
                fetchPlans();
            }
        } catch (e: any) {
            showAlert('Sync Notice', e.message || 'Sync function executed with notices.', 'success');
            fetchPlans();
        } finally {
            setSyncing(false);
        }
    };

    const handleSetActivePrimaryVendor = async (vendorId: string) => {
        try {
            const { error } = await supabase
                .from('app_settings')
                .upsert({ key: 'vtu_vendor', value: { vendor: vendorId } });

            if (error) throw error;

            setActiveVendor(vendorId);
            showAlert('API Provider Updated! ⚡', `System primary VTU Provider is now set to ${vendorId.toUpperCase()}.`);
        } catch (e: any) {
            showAlert('Error', e.message || 'Failed updating primary vendor.', 'error');
        }
    };

    const handleUpdatePrice = async () => {
        if (!editingPlan) return;
        const priceNum = parseFloat(newPrice);
        if (isNaN(priceNum) || priceNum <= 0) {
            showAlert('Invalid Price', 'Please enter a valid positive selling price.', 'error');
            return;
        }

        const finalPlanType = customTypeInput.trim() ? customTypeInput.trim().toUpperCase() : selectedPlanType;

        // If custom type entered, add to planTypesList if not present
        if (customTypeInput.trim() && !planTypesList.includes(finalPlanType)) {
            const updated = [...planTypesList, finalPlanType];
            setPlanTypesList(updated);
            supabase.from('app_settings').upsert({ key: 'data_plan_types', value: updated }).then(() => {});
        }

        try {
            const { error } = await supabase
                .from('data_plans')
                .update({ 
                    selling_price: priceNum,
                    plan_type: finalPlanType 
                })
                .eq('id', editingPlan.id);

            if (error) throw error;

            setEditingPlan(null);
            setNewPrice('');
            setCustomTypeInput('');
            showAlert('Plan Updated 🎉', `Selling price set to ₦${priceNum} & Plan Type set to ${finalPlanType}.`);
            fetchPlans();
        } catch (e: any) {
            showAlert('Error', e.message, 'error');
        }
    };

    const handleUpdateConfig = async () => {
        if (!editingConfig) return;
        const val = parseFloat(newMarkupValue);
        if (isNaN(val) || val < 0) {
            showAlert('Invalid Markup', 'Please enter a valid markup value.', 'error');
            return;
        }

        let error;
        if (editingConfig.id) {
            const { error: err } = await supabase
                .from('data_configs')
                .update({ markup_type: newMarkupType, markup_value: val })
                .eq('id', editingConfig.id);
            error = err;
        } else {
            const { error: err } = await supabase
                .from('data_configs')
                .insert({ network: editingConfig.network, markup_type: newMarkupType, markup_value: val });
            error = err;
        }

        if (error) {
            showAlert('Error', error.message, 'error');
        } else {
            setEditingConfig(null);
            setNewMarkupValue('');
            fetchConfigsAndPlanTypes();
            showAlert('Markup Config Saved 🎉', 'Default network markup saved. Click "Apply Markup" to update plan prices.');
        }
    };

    const handleApplyMarkups = async () => {
        setApplyingMarkups(true);
        try {
            const config = configs.find(c => c.network === selectedNetwork);
            if (!config) {
                showAlert("Error", `No markup configuration found for ${selectedNetwork.toUpperCase()}`, 'error');
                return;
            }

            const { data: activePlans, error: fetchErr } = await supabase
                .from('data_plans')
                .select('*')
                .eq('network', selectedNetwork);

            if (fetchErr) throw fetchErr;
            if (!activePlans || activePlans.length === 0) {
                showAlert("Info", "No plans found for this network. Sync plans first.", 'error');
                return;
            }

            for (const plan of activePlans) {
                const cost = parseFloat(plan.cost_price);
                let selling = cost;
                if (config.markup_type === 'percentage') {
                    selling = cost * (1 + (parseFloat(config.markup_value) / 100));
                } else {
                    selling = cost + parseFloat(config.markup_value);
                }
                selling = Math.round(selling);

                const { error: updateErr } = await supabase
                    .from('data_plans')
                    .update({ selling_price: selling })
                    .eq('id', plan.id);
                
                if (updateErr) throw updateErr;
            }

            showAlert("Markup Applied 🎉", `Selling prices for ${selectedNetwork.toUpperCase()} plans updated using ${config.markup_type === 'percentage' ? `${config.markup_value}%` : `₦${config.markup_value}`} markup.`);
            fetchPlans();
        } catch (e: any) {
            showAlert("Error", e.message || "Failed to apply markup", 'error');
        } finally {
            setApplyingMarkups(false);
        }
    };

    const toggleActive = async (plan: any) => {
        const { error } = await supabase
            .from('data_plans')
            .update({ is_active: !plan.is_active })
            .eq('id', plan.id);
            
        if (error) showAlert('Error', error.message, 'error');
        else fetchPlans();
    };

    return (
        <View style={{ flex: 1, backgroundColor: L.bg }}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Light Executive Header Bar */}
            <LinearGradient
                colors={['#0F172A', '#1E293B', '#334155']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ 
                    paddingTop: insets.top + 8, 
                    paddingBottom: 14, 
                    paddingHorizontal: 16, 
                    borderBottomWidth: 2, 
                    borderColor: L.gold,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <TouchableOpacity 
                        onPress={() => router.back()} 
                        style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: L.gold, alignItems: 'center', justifyContent: 'center' }}
                    >
                        <Ionicons name="arrow-back" size={18} color={L.gold} />
                    </TouchableOpacity>
                    <View>
                        <Text style={{ fontSize: 13, fontWeight: '900', color: L.gold, letterSpacing: 0.8 }}>
                            DATA PRICING & PLAN TYPES
                        </Text>
                        <Text style={{ color: '#94A3B8', fontSize: 9.5 }}>Dynamic Plan Types Creator & Multi-API Tariffs</Text>
                    </View>
                </View>

                <TouchableOpacity 
                    onPress={() => handleSync('all')} 
                    disabled={syncing}
                    style={{ backgroundColor: L.gold, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                    {syncing ? <ActivityIndicator size="small" color="#0F172A" /> : <Ionicons name="cloud-download" size={14} color="#0F172A" />}
                    <Text style={{ color: '#0F172A', fontSize: 10.5, fontWeight: '900' }}>Sync All</Text>
                </TouchableOpacity>
            </LinearGradient>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
                
                {/* Active Vendor Card */}
                <View style={{ backgroundColor: L.card, borderRadius: 16, borderWidth: 1, borderColor: L.inputBorder, padding: 12, margin: 12, elevation: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Ionicons name="server" size={16} color={L.navyHeader} />
                            <Text style={{ color: L.textPrimary, fontSize: 12, fontWeight: '900' }}>API Provider System Filter</Text>
                        </View>
                        <View style={{ backgroundColor: L.emeraldBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: L.emeraldBorder }}>
                            <Text style={{ color: L.emerald, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' }}>
                                Active: {activeVendor}
                            </Text>
                        </View>
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                        {VENDORS.map(vendor => {
                            const isSelected = selectedVendorFilter === vendor.id;
                            const isPrimary = activeVendor.includes(vendor.id);
                            return (
                                <TouchableOpacity
                                    key={vendor.id}
                                    onPress={() => setSelectedVendorFilter(vendor.id)}
                                    onLongPress={() => {
                                        if (vendor.id !== 'all') handleSetActivePrimaryVendor(vendor.id);
                                    }}
                                    style={{ 
                                        backgroundColor: isSelected ? L.navyHeader : vendor.bg, 
                                        borderWidth: 1, 
                                        borderColor: isPrimary ? L.emerald : isSelected ? L.navyHeader : L.inputBorder,
                                        borderRadius: 10, 
                                        paddingHorizontal: 12, 
                                        paddingVertical: 8, 
                                        marginRight: 8,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 6
                                    }}
                                >
                                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isPrimary ? L.emerald : vendor.color }} />
                                    <Text style={{ color: isSelected ? '#FFFFFF' : L.textPrimary, fontSize: 11, fontWeight: '800' }}>
                                        {vendor.name}
                                    </Text>
                                    {isPrimary && vendor.id !== 'all' && (
                                        <Text style={{ color: L.emerald, fontSize: 8.5, fontWeight: '900' }}>✓ DEFAULT</Text>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>

                {/* Plan Type Creator & Selector Card */}
                <View style={{ backgroundColor: L.card, borderRadius: 16, borderWidth: 1, borderColor: L.inputBorder, padding: 12, marginHorizontal: 12, marginBottom: 12, elevation: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={{ color: L.navyHeader, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }}>
                            Configured Plan Types Category:
                        </Text>
                        <TouchableOpacity 
                            onPress={() => setShowAddTypeModal(true)}
                            style={{ backgroundColor: L.emeraldBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: L.emeraldBorder, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                        >
                            <Ionicons name="add-circle" size={14} color={L.emerald} />
                            <Text style={{ color: L.emerald, fontSize: 10, fontWeight: '900' }}>➕ Add Plan Type</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {['all', ...planTypesList].map(type => {
                            const isSelected = selectedPlanTypeFilter === type;
                            return (
                                <TouchableOpacity
                                    key={type}
                                    onPress={() => setSelectedPlanTypeFilter(type)}
                                    style={{
                                        backgroundColor: isSelected ? L.gold : L.bg,
                                        borderWidth: 1,
                                        borderColor: isSelected ? L.goldDk : L.inputBorder,
                                        borderRadius: 10,
                                        paddingHorizontal: 12,
                                        paddingVertical: 6
                                    }}
                                >
                                    <Text style={{ color: isSelected ? '#0F172A' : L.textSecondary, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }}>
                                        {type === 'all' ? 'All Types' : type}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Network Markup Configurations Card */}
                <View style={{ backgroundColor: L.card, borderRadius: 16, borderWidth: 1, borderColor: L.inputBorder, padding: 12, marginHorizontal: 12, marginBottom: 12, elevation: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="trending-up" size={16} color={L.goldDk} />
                            <Text style={{ color: L.textPrimary, fontSize: 12, fontWeight: '900' }}>Markup Configs</Text>
                        </View>
                        
                        <TouchableOpacity 
                            onPress={handleApplyMarkups}
                            disabled={applyingMarkups}
                            style={{ backgroundColor: L.navyHeader, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                        >
                            {applyingMarkups ? <ActivityIndicator size="small" color={L.gold} /> : <Ionicons name="flash" size={12} color={L.gold} />}
                            <Text style={{ color: L.gold, fontSize: 10, fontWeight: '900' }}>
                                Apply Markup ({selectedNetwork.toUpperCase()})
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 6 }}>
                        {networks.map(net => {
                            const conf = configs.find(c => c.network === net) || { network: net, markup_type: 'fixed', markup_value: 0 };
                            return (
                                <TouchableOpacity
                                    key={net}
                                    onPress={() => {
                                        setEditingConfig(conf);
                                        setNewMarkupValue(conf.markup_value.toString());
                                        setNewMarkupType(conf.markup_type as any);
                                    }}
                                    style={{ flex: 1, backgroundColor: L.bg, borderRadius: 10, borderWidth: 1, borderColor: L.inputBorder, padding: 8, alignItems: 'center' }}
                                >
                                    <Text style={{ color: L.textMuted, fontSize: 9.5, fontWeight: '900', textTransform: 'uppercase' }}>{net}</Text>
                                    <Text style={{ color: L.navyHeader, fontSize: 11, fontWeight: '900', marginTop: 2 }}>
                                        {conf.markup_type === 'percentage' ? `${conf.markup_value}%` : `₦${conf.markup_value}`}
                                    </Text>
                                    <Text style={{ color: L.blue, fontSize: 8.5, fontWeight: '700', marginTop: 2 }}>Edit ✏️</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Network Selector Tabs Bar */}
                <View style={{ flexDirection: 'row', paddingHorizontal: 12, marginBottom: 12, gap: 6 }}>
                    {networks.map(net => {
                        const isSelected = selectedNetwork === net;
                        return (
                            <TouchableOpacity
                                key={net}
                                onPress={() => setSelectedNetwork(net)}
                                style={{ 
                                    flex: 1, 
                                    backgroundColor: isSelected ? L.navyHeader : L.card, 
                                    borderRadius: 10, 
                                    paddingVertical: 8, 
                                    alignItems: 'center',
                                    borderWidth: 1,
                                    borderColor: isSelected ? L.navyHeader : L.inputBorder,
                                    elevation: isSelected ? 2 : 0
                                }}
                            >
                                <Text style={{ color: isSelected ? '#FFFFFF' : L.textSecondary, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }}>
                                    {net}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Data Plans List */}
                {loading ? (
                    <View style={{ padding: 40, alignItems: 'center' }}>
                        <ActivityIndicator size="large" color={L.navyHeader} />
                        <Text style={{ color: L.textMuted, fontSize: 11, marginTop: 8 }}>Loading {selectedNetwork.toUpperCase()} data tariffs...</Text>
                    </View>
                ) : (
                    <View style={{ paddingHorizontal: 12, gap: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 4 }}>
                            <Text style={{ color: L.navyHeader, fontSize: 11, fontWeight: '900' }}>
                                Showing {plans.length} Data Plans for {selectedNetwork.toUpperCase()}
                            </Text>
                        </View>

                        {plans.map((plan) => {
                            const cost = parseFloat(plan.cost_price || '0');
                            const selling = parseFloat(plan.selling_price || '0');
                            const profit = selling - cost;
                            
                            const detectPlanType = (p: any): string => {
                                if (p.plan_type && p.plan_type.trim() !== '') return p.plan_type.trim().toUpperCase();
                                const n = (p.name || '').toLowerCase();
                                if (n.includes('corporate') || n.includes('cg') || n.includes('c-g')) return 'CG';
                                if (n.includes('gifting') || n.includes('gift')) return 'GIFTING';
                                if (n.includes('promo')) return 'PROMO';
                                if (n.includes('mega')) return 'MEGA';
                                if (n.includes('night')) return 'NIGHT';
                                if (n.includes('direct')) return 'DIRECT';
                                if (n.includes('coupon')) return 'COUPON';
                                if (n.includes('sme') || n.includes('s-m-e')) return 'SME';
                                return 'DIRECT';
                            };

                            const currentPlanType = detectPlanType(plan);
                            const vendorName = plan.api_vendor ? plan.api_vendor.toUpperCase() : (plan.name?.toLowerCase().includes('bilal') ? 'BILALSADASUB' : plan.name?.toLowerCase().includes('bigi') ? 'BIGI' : 'CLUBKONNECT');

                            return (
                                <View 
                                    key={plan.id}
                                    style={{ 
                                        backgroundColor: L.card, 
                                        borderRadius: 14, 
                                        borderWidth: 1, 
                                        borderColor: L.inputBorder, 
                                        padding: 12,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        elevation: 1
                                    }}
                                >
                                    <View style={{ flex: 1, paddingRight: 8 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                                            <Text style={{ color: L.textPrimary, fontSize: 12.5, fontWeight: '900' }}>
                                                {plan.name}
                                            </Text>
                                            <View style={{ backgroundColor: L.goldBg, paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 6, borderWidth: 1, borderColor: L.goldBorder }}>
                                                <Text style={{ color: L.goldDk, fontSize: 8.5, fontWeight: '900', textTransform: 'uppercase' }}>
                                                    🏷️ {currentPlanType}
                                                </Text>
                                            </View>
                                            <View style={{ backgroundColor: '#EFF6FF', paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 6, borderWidth: 1, borderColor: '#BFDBFE' }}>
                                                <Text style={{ color: '#1D4ED8', fontSize: 8.5, fontWeight: '900', textTransform: 'uppercase' }}>
                                                    ⚡ API: {vendorName}
                                                </Text>
                                            </View>
                                        </View>

                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                            <Text style={{ color: L.textMuted, fontSize: 10 }}>
                                                Cost: <Text style={{ color: L.textSecondary, fontWeight: '800' }}>₦{cost}</Text>
                                            </Text>
                                            <Text style={{ color: L.emerald, fontSize: 10, fontWeight: '900' }}>
                                                Sell: ₦{selling}
                                            </Text>
                                            <View style={{ backgroundColor: profit >= 0 ? L.emeraldBg : L.roseBg, paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 6 }}>
                                                <Text style={{ color: profit >= 0 ? L.emerald : L.rose, fontSize: 8.5, fontWeight: '900' }}>
                                                    Profit: ₦{profit.toFixed(1)}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>

                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                        <TouchableOpacity
                                            onPress={() => {
                                                setEditingPlan(plan);
                                                setNewPrice(plan.selling_price?.toString() || '');
                                                setSelectedPlanType(currentPlanType);
                                                setCustomTypeInput('');
                                            }}
                                            style={{ backgroundColor: L.navyHeader, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}
                                        >
                                            <Text style={{ color: L.gold, fontSize: 10, fontWeight: '900' }}>Edit Price/Type ✏️</Text>
                                        </TouchableOpacity>

                                        <Switch
                                            trackColor={{ false: '#CBD5E1', true: '#059669' }}
                                            thumbColor={plan.is_active ? L.emerald : '#FFFFFF'}
                                            onValueChange={() => toggleActive(plan)}
                                            value={plan.is_active}
                                            style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                                        />
                                    </View>
                                </View>
                            );
                        })}

                        {plans.length === 0 && (
                            <View style={{ backgroundColor: L.card, borderRadius: 14, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: L.inputBorder }}>
                                <Ionicons name="wifi" size={28} color={L.textMuted} />
                                <Text style={{ color: L.textMuted, fontSize: 11, marginTop: 8 }}>
                                    No data plans found for {selectedNetwork.toUpperCase()} ({selectedPlanTypeFilter}). Click "Sync All" above.
                                </Text>
                            </View>
                        )}
                    </View>
                )}

            </ScrollView>

            {/* ADD CUSTOM PLAN TYPE MODAL */}
            <Modal visible={showAddTypeModal} transparent={true} animationType="fade">
                <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.75)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
                    <View style={{ width: '100%', maxWidth: 400, backgroundColor: L.card, borderRadius: 20, borderWidth: 1.5, borderColor: L.gold, padding: 20 }}>
                        <Text style={{ color: L.textPrimary, fontSize: 14, fontWeight: '900', marginBottom: 2 }}>
                            ➕ Add New Custom Plan Type
                        </Text>
                        <Text style={{ color: L.textMuted, fontSize: 10.5, marginBottom: 14 }}>
                            Enter a new custom Plan Type category (e.g. PROMO, MEGA SME, HOT DEAL). It will load automatically for users!
                        </Text>

                        <TextInput 
                            style={{ 
                                backgroundColor: L.bg, 
                                borderWidth: 1.5, 
                                borderColor: L.navyHeader, 
                                borderRadius: 12, 
                                padding: 12, 
                                color: L.textPrimary, 
                                fontSize: 14, 
                                fontWeight: '800', 
                                marginBottom: 16 
                            }}
                            placeholder="e.g. PROMO, MEGA SME, NIGHT..."
                            placeholderTextColor={L.textMuted}
                            value={newCustomTypeName}
                            onChangeText={setNewCustomTypeName}
                            autoFocus
                        />

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity 
                                style={{ flex: 1, backgroundColor: L.bg, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: L.inputBorder }}
                                onPress={() => setShowAddTypeModal(false)}
                            >
                                <Text style={{ color: L.textMuted, fontWeight: '800', fontSize: 11 }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={{ flex: 1.5, backgroundColor: L.gold, borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' }}
                                onPress={handleCreateNewPlanType}
                            >
                                <Text style={{ color: '#0F172A', fontWeight: '900', fontSize: 11 }}>Create Plan Type 🚀</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* EDIT SELLING PRICE & PLAN TYPE MODAL */}
            {editingPlan && (
                <Modal visible={true} transparent={true} animationType="fade">
                    <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.75)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
                        <View style={{ width: '100%', maxWidth: 440, backgroundColor: L.card, borderRadius: 20, borderWidth: 1.5, borderColor: L.navyHeader, padding: 20 }}>
                            <Text style={{ color: L.textPrimary, fontSize: 14, fontWeight: '900', marginBottom: 2 }}>Edit Price & Plan Type</Text>
                            <Text style={{ color: L.textMuted, fontSize: 10.5, marginBottom: 12 }}>{editingPlan.name}</Text>
                            
                            <View style={{ backgroundColor: L.bg, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: L.inputBorder, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <Text style={{ color: L.textMuted, fontSize: 10, fontWeight: '700' }}>API COST PRICE</Text>
                                <Text style={{ color: L.navyHeader, fontSize: 13, fontWeight: '900' }}>₦{editingPlan.cost_price}</Text>
                            </View>

                            {/* Plan Type Selector */}
                            <Text style={{ color: L.navyHeader, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginBottom: 6 }}>
                                Select or Type Custom Plan Category
                            </Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                                {planTypesList.map(type => {
                                    const isSelected = selectedPlanType === type && !customTypeInput.trim();
                                    return (
                                        <TouchableOpacity
                                            key={type}
                                            onPress={() => {
                                                setSelectedPlanType(type);
                                                setCustomTypeInput('');
                                            }}
                                            style={{
                                                backgroundColor: isSelected ? L.navyHeader : L.bg,
                                                borderRadius: 8,
                                                paddingHorizontal: 10,
                                                paddingVertical: 6,
                                                borderWidth: 1,
                                                borderColor: isSelected ? L.navyHeader : L.inputBorder
                                            }}
                                        >
                                            <Text style={{ color: isSelected ? L.gold : L.textSecondary, fontSize: 10.5, fontWeight: '900' }}>
                                                {type}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Custom Type Input Fallback */}
                            <TextInput 
                                style={{ 
                                    backgroundColor: L.bg, 
                                    borderWidth: 1, 
                                    borderColor: customTypeInput.trim() ? L.gold : L.inputBorder, 
                                    borderRadius: 10, 
                                    padding: 10, 
                                    color: L.textPrimary, 
                                    fontSize: 12, 
                                    fontWeight: '700', 
                                    marginBottom: 14 
                                }}
                                placeholder="Or type new custom Plan Type (e.g. PROMO)..."
                                placeholderTextColor={L.textMuted}
                                value={customTypeInput}
                                onChangeText={setCustomTypeInput}
                            />

                            {/* New Selling Price Input */}
                            <Text style={{ color: L.navyHeader, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginBottom: 6 }}>
                                New Selling Price (₦)
                            </Text>
                            <TextInput 
                                style={{ 
                                    backgroundColor: L.bg, 
                                    borderWidth: 1.5, 
                                    borderColor: L.navyHeader, 
                                    borderRadius: 12, 
                                    padding: 12, 
                                    color: L.textPrimary, 
                                    fontSize: 16, 
                                    fontWeight: '900', 
                                    marginBottom: 16 
                                }}
                                keyboardType="numeric"
                                value={newPrice}
                                onChangeText={setNewPrice}
                            />

                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <TouchableOpacity 
                                    style={{ flex: 1, backgroundColor: L.bg, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: L.inputBorder }}
                                    onPress={() => setEditingPlan(null)}
                                >
                                    <Text style={{ color: L.textMuted, fontWeight: '800', fontSize: 11 }}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={{ flex: 1.5, backgroundColor: L.navyHeader, borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' }}
                                    onPress={handleUpdatePrice}
                                >
                                    <Text style={{ color: L.gold, fontWeight: '900', fontSize: 11 }}>Save Changes 💾</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}

            {/* EDIT MARKUP CONFIG MODAL */}
            {editingConfig && (
                <Modal visible={true} transparent={true} animationType="fade">
                    <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.75)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
                        <View style={{ width: '100%', maxWidth: 420, backgroundColor: L.card, borderRadius: 20, borderWidth: 1.5, borderColor: L.navyHeader, padding: 18 }}>
                            <Text style={{ color: L.textPrimary, fontSize: 14, fontWeight: '900', marginBottom: 2 }}>
                                Markup Config ({editingConfig.network.toUpperCase()})
                            </Text>
                            <Text style={{ color: L.textMuted, fontSize: 10, marginBottom: 12 }}>
                                Set default profit markup for all {editingConfig.network.toUpperCase()} plans.
                            </Text>
                            
                            <Text style={{ color: L.navyHeader, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginBottom: 6 }}>
                                Markup Type
                            </Text>
                            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                                <TouchableOpacity 
                                    onPress={() => setNewMarkupType('fixed')}
                                    style={{
                                        flex: 1,
                                        backgroundColor: newMarkupType === 'fixed' ? L.navyHeader : L.bg,
                                        borderRadius: 10,
                                        paddingVertical: 8,
                                        alignItems: 'center',
                                        borderWidth: 1,
                                        borderColor: newMarkupType === 'fixed' ? L.navyHeader : L.inputBorder
                                    }}
                                >
                                    <Text style={{ color: newMarkupType === 'fixed' ? '#FFFFFF' : L.textSecondary, fontSize: 11, fontWeight: '900' }}>
                                        Fixed (₦)
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    onPress={() => setNewMarkupType('percentage')}
                                    style={{
                                        flex: 1,
                                        backgroundColor: newMarkupType === 'percentage' ? L.navyHeader : L.bg,
                                        borderRadius: 10,
                                        paddingVertical: 8,
                                        alignItems: 'center',
                                        borderWidth: 1,
                                        borderColor: newMarkupType === 'percentage' ? L.navyHeader : L.inputBorder
                                    }}
                                >
                                    <Text style={{ color: newMarkupType === 'percentage' ? '#FFFFFF' : L.textSecondary, fontSize: 11, fontWeight: '900' }}>
                                        Percentage (%)
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={{ color: L.navyHeader, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginBottom: 6 }}>
                                {newMarkupType === 'percentage' ? 'Markup Percentage (%)' : 'Markup Amount (₦)'}
                            </Text>
                            <TextInput 
                                style={{ 
                                    backgroundColor: L.bg, 
                                    borderWidth: 1.5, 
                                    borderColor: L.navyHeader, 
                                    borderRadius: 12, 
                                    padding: 12, 
                                    color: L.textPrimary, 
                                    fontSize: 16, 
                                    fontWeight: '900', 
                                    marginBottom: 16 
                                }}
                                keyboardType="numeric"
                                value={newMarkupValue}
                                onChangeText={setNewMarkupValue}
                                autoFocus
                            />

                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <TouchableOpacity 
                                    style={{ flex: 1, backgroundColor: L.bg, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: L.inputBorder }}
                                    onPress={() => setEditingConfig(null)}
                                >
                                    <Text style={{ color: L.textMuted, fontWeight: '800', fontSize: 11 }}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={{ flex: 1.5, backgroundColor: L.navyHeader, borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' }}
                                    onPress={handleUpdateConfig}
                                >
                                    <Text style={{ color: L.gold, fontWeight: '900', fontSize: 11 }}>Save Config 💾</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}

            {/* Ultra Premium Sync Report Modal */}
            <Modal
                visible={syncResultModal.visible}
                transparent
                animationType="slide"
                onRequestClose={() => setSyncResultModal(prev => ({ ...prev, visible: false }))}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.8)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: L.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '88%', borderTopWidth: 3, borderColor: L.goldDk }}>
                        
                        {/* Header */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: L.navyHeader, alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons name="cloud-download-sharp" size={18} color={L.gold} />
                                </View>
                                <View>
                                    <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 15 }}>API SYNC REPORT MATRIX</Text>
                                    <Text style={{ color: L.goldDk, fontSize: 10, fontWeight: '800' }}>TOTAL SYNCED: {syncResultModal.total} PLANS</Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                onPress={() => setSyncResultModal(prev => ({ ...prev, visible: false }))}
                                style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: L.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: L.inputBorder }}
                            >
                                <Ionicons name="close" size={18} color={L.navyHeader} />
                            </TouchableOpacity>
                        </View>

                        {/* API Vendor Selection Tabs */}
                        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12, backgroundColor: L.bg, padding: 3, borderRadius: 12, borderWidth: 1, borderColor: L.inputBorder }}>
                            {[
                                { id: 'bilalsadasub', name: 'BilalSadaSub API' },
                                { id: 'clubkonnect', name: 'ClubKonnect' },
                                { id: 'bigi', name: 'Bigi VTU' }
                            ].map((v) => {
                                const isSelected = syncResultModal.selectedVendorTab === v.id;
                                const vendorData = syncResultModal.vendorBreakdown?.[v.id];
                                const count = vendorData?.total || 0;
                                return (
                                    <TouchableOpacity
                                        key={v.id}
                                        onPress={() => setSyncResultModal(prev => ({ ...prev, selectedVendorTab: v.id }))}
                                        style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: isSelected ? L.navyHeader : 'transparent', borderWidth: isSelected ? 1 : 0, borderColor: L.gold }}
                                    >
                                        <Text style={{ color: isSelected ? L.gold : L.textSecondary, fontWeight: '900', fontSize: 10 }}>{v.name}</Text>
                                        <Text style={{ color: isSelected ? '#FFFFFF' : L.textMuted, fontWeight: '800', fontSize: 9, marginTop: 1 }}>{count} Plans</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {(() => {
                            const curVendorKey = syncResultModal.selectedVendorTab;
                            const curVendorData = syncResultModal.vendorBreakdown?.[curVendorKey] || {
                                name: curVendorKey.toUpperCase(),
                                total: 0,
                                networks: { MTN: 0, GLO: 0, AIRTEL: 0, '9MOBILE': 0, VITAL: 0 },
                                plans: []
                            };
                            const nets = curVendorData.networks || {};
                            const plans = curVendorData.plans || [];

                            return (
                                <>
                                    {/* Active Vendor Header Banner */}
                                    <View style={{ backgroundColor: L.goldBg, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: L.goldDk, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Ionicons name="sparkles" size={15} color={L.goldDk} />
                                            <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 12 }}>{curVendorData.name}</Text>
                                        </View>
                                        <Text style={{ color: L.goldDk, fontWeight: '900', fontSize: 12 }}>{curVendorData.total} Plans</Text>
                                    </View>

                                    {/* 5 Network Cards Grid for this Vendor */}
                                    <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Network Breakdown for {curVendorData.name}</Text>
                                    
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                                        {[
                                            { name: 'MTN', count: nets.MTN || 0, color: '#D97706', bg: '#FEF3C7' },
                                            { name: 'GLO', count: nets.GLO || 0, color: '#16A34A', bg: '#DCFCE7' },
                                            { name: 'AIRTEL', count: nets.AIRTEL || 0, color: '#DC2626', bg: '#FEE2E2' },
                                            { name: '9MOBILE', count: nets['9MOBILE'] || 0, color: '#059669', bg: '#D1FAE5' },
                                            { name: 'VITAL', count: nets.VITAL || 0, color: '#7C3AED', bg: '#EDE9FE' },
                                        ].map((net) => (
                                            <View key={net.name} style={{ width: '18%', backgroundColor: net.bg, paddingVertical: 8, paddingHorizontal: 2, borderRadius: 10, borderWidth: 1, borderColor: net.color, alignItems: 'center' }}>
                                                <Text style={{ color: net.color, fontWeight: '900', fontSize: 9 }}>{net.name}</Text>
                                                <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 13, marginTop: 1 }}>{net.count}</Text>
                                            </View>
                                        ))}
                                    </View>

                                    {/* Synced Plans List for this Vendor */}
                                    <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Data Plans ({plans.length})</Text>
                                    
                                    <ScrollView style={{ maxHeight: 200 }} contentContainerStyle={{ gap: 6 }}>
                                        {plans.length === 0 ? (
                                            <View style={{ padding: 16, alignItems: 'center' }}>
                                                <Text style={{ color: L.textMuted, fontSize: 11 }}>No plans fetched for this vendor.</Text>
                                            </View>
                                        ) : (
                                            plans.map((p: any, idx: number) => (
                                                <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: L.bg, padding: 9, borderRadius: 12, borderWidth: 1, borderColor: L.inputBorder }}>
                                                    <View style={{ flex: 1, marginRight: 8 }}>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                            <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 11 }}>{p.name}</Text>
                                                            <View style={{ backgroundColor: L.goldBg, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, borderWidth: 1, borderColor: L.goldDk }}>
                                                                <Text style={{ color: L.goldDk, fontWeight: '900', fontSize: 8 }}>{p.plan_type || 'DIRECT'}</Text>
                                                            </View>
                                                            <View style={{ backgroundColor: L.navyHeader, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 }}>
                                                                <Text style={{ color: L.gold, fontWeight: '900', fontSize: 8, textTransform: 'uppercase' }}>{(p.network || '').toUpperCase()}</Text>
                                                            </View>
                                                        </View>
                                                        <Text style={{ color: L.textMuted, fontSize: 9, marginTop: 1 }}>ID: {p.plan_id} • Vendor: {p.api_vendor || curVendorKey}</Text>
                                                    </View>
                                                    <View style={{ alignItems: 'flex-end' }}>
                                                        <Text style={{ color: L.emerald, fontWeight: '900', fontSize: 11 }}>₦{p.selling_price}</Text>
                                                        <Text style={{ color: L.textMuted, fontSize: 8 }}>Cost: ₦{p.cost_price}</Text>
                                                    </View>
                                                </View>
                                            ))
                                        )}
                                    </ScrollView>
                                </>
                            );
                        })()}

                        <TouchableOpacity
                            onPress={() => setSyncResultModal(prev => ({ ...prev, visible: false }))}
                            style={{ backgroundColor: L.navyHeader, paddingVertical: 12, borderRadius: 14, alignItems: 'center', borderWidth: 1.5, borderColor: L.gold, marginTop: 12 }}
                        >
                            <Text style={{ color: L.gold, fontWeight: '900', fontSize: 12, textTransform: 'uppercase' }}>Done & Close</Text>
                        </TouchableOpacity>

                    </View>
                </View>
            </Modal>
        </View>
    );
}
