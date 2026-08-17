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

// Executive Royal Navy & Gold Theme Palette
const L = {
    bg: '#020617',
    card: '#0F172A',
    cardBorder: 'rgba(245, 158, 11, 0.35)',
    navyHeader: '#0B132B',
    gold: '#F59E0B',
    goldDk: '#D97706',
    goldBg: 'rgba(245, 158, 11, 0.12)',
    textPrimary: '#F8FAFC',
    textSecondary: '#CBD5E1',
    textMuted: '#64748B',
    inputBg: '#0F172A',
    inputBorder: '#1E293B',
    emerald: '#10B981',
    emeraldBg: 'rgba(16, 185, 129, 0.15)',
    emeraldBorder: '#059669',
    blue: '#3B82F6',
    blueBg: 'rgba(59, 130, 246, 0.15)',
    rose: '#EF4444',
    roseBg: 'rgba(239, 68, 68, 0.15)'
};

const VENDORS = [
    { id: 'all', name: 'All Vendors', color: '#64748B', bg: 'rgba(100, 116, 139, 0.15)' },
    { id: 'clubkonnect', name: 'ClubKonnect', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)' },
    { id: 'bigi', name: 'Bigi VTU', color: '#818CF8', bg: 'rgba(129, 140, 248, 0.15)' },
    { id: 'bilalsadasub', name: 'BilalSadaSub', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' },
];

export default function ManageDataPlans() {
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [plans, setPlans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [selectedNetwork, setSelectedNetwork] = useState('mtn');
    const [selectedVendorFilter, setSelectedVendorFilter] = useState('all');
    const [editingPlan, setEditingPlan] = useState<any | null>(null);
    const [newPrice, setNewPrice] = useState('');
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

    // Markup Configs
    const [configs, setConfigs] = useState<any[]>([]);
    const [editingConfig, setEditingConfig] = useState<any | null>(null);
    const [newMarkupValue, setNewMarkupValue] = useState('');
    const [newMarkupType, setNewMarkupType] = useState<'fixed' | 'percentage'>('fixed');
    const [applyingMarkups, setApplyingMarkups] = useState(false);

    const networks = ['mtn', 'glo', 'airtel', '9mobile', 'vitel'];

    useEffect(() => {
        fetchConfigs();
    }, []);

    useEffect(() => {
        fetchPlans();
    }, [selectedNetwork, selectedVendorFilter]);

    const fetchConfigs = async () => {
        try {
            const { data: vendorData } = await supabase.from('app_settings').select('value').eq('key', 'vtu_vendor').single();
            if (vendorData && vendorData.value) {
                const v = typeof vendorData.value === 'object' ? vendorData.value.vendor || vendorData.value : vendorData.value;
                setActiveVendor(String(v).toLowerCase());
            }

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
            const { data, error } = await supabase
                .from('data_plans')
                .select('*')
                .eq('network', selectedNetwork)
                .order('cost_price', { ascending: true });

            let resultPlans = data || [];

            if (selectedVendorFilter === 'bilalsadasub') {
                resultPlans = resultPlans.filter(p => p.api_vendor === 'bilalsadasub' || p.name?.toLowerCase().includes('bilal'));
            } else if (selectedVendorFilter === 'bigi') {
                resultPlans = resultPlans.filter(p => p.api_vendor === 'bigi' || p.name?.toLowerCase().includes('bigi'));
            } else if (selectedVendorFilter === 'clubkonnect') {
                resultPlans = resultPlans.filter(p => !p.api_vendor || p.api_vendor === 'clubkonnect' || p.name?.toLowerCase().includes('club'));
            }

            setPlans(resultPlans);
        } catch (error: any) {
            showAlert('Data Error', error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSync = async (vendorId: string) => {
        setSyncing(true);
        try {
            const { data, error } = await supabase.functions.invoke('sync-plans', {
                body: { vendor: vendorId }
            });

            if (error) throw error;

            showAlert('Sync Complete 🎉', `Data plans updated successfully from ${vendorId.toUpperCase()} API.`);
            fetchPlans();
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

        try {
            const { error } = await supabase
                .from('data_plans')
                .update({ selling_price: priceNum })
                .eq('id', editingPlan.id);

            if (error) throw error;

            setEditingPlan(null);
            setNewPrice('');
            showAlert('Price Updated 🎉', `Selling price for "${editingPlan.name}" is set to ₦${priceNum}.`);
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
            fetchConfigs();
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

            {/* Header */}
            <LinearGradient
                colors={['#020617', '#0F172A', '#1E293B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ 
                    paddingTop: insets.top + 8, 
                    paddingBottom: 14, 
                    paddingHorizontal: 16, 
                    borderBottomWidth: 1.5, 
                    borderColor: L.goldDk,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <TouchableOpacity 
                        onPress={() => router.back()} 
                        style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: L.gold, alignItems: 'center', justifyContent: 'center' }}
                    >
                        <Ionicons name="arrow-back" size={18} color={L.gold} />
                    </TouchableOpacity>
                    <View>
                        <Text style={{ fontSize: 13, fontWeight: '900', color: L.gold, letterSpacing: 0.8 }}>
                            DATA PRICING & API CONTROL
                        </Text>
                        <Text style={{ color: L.textMuted, fontSize: 9.5 }}>Multi-Vendor Tariff & Profit Margin Engine</Text>
                    </View>
                </View>

                <TouchableOpacity 
                    onPress={() => handleSync('all')} 
                    disabled={syncing}
                    style={{ backgroundColor: L.goldBg, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: L.gold, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                    {syncing ? <ActivityIndicator size="small" color={L.gold} /> : <Ionicons name="cloud-download-outline" size={14} color={L.gold} />}
                    <Text style={{ color: L.gold, fontSize: 10.5, fontWeight: '900' }}>Sync All</Text>
                </TouchableOpacity>
            </LinearGradient>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
                
                {/* Active Vendor Card */}
                <View style={{ backgroundColor: L.card, borderRadius: 16, borderWidth: 1, borderColor: L.cardBorder, padding: 12, margin: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Ionicons name="server" size={16} color={L.gold} />
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
                                        backgroundColor: isSelected ? L.goldBg : L.bg, 
                                        borderWidth: 1, 
                                        borderColor: isPrimary ? L.emerald : isSelected ? L.gold : L.inputBorder,
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
                                    <Text style={{ color: isSelected ? L.gold : L.textSecondary, fontSize: 11, fontWeight: '800' }}>
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

                {/* Network Markup Configurations Card */}
                <View style={{ backgroundColor: L.card, borderRadius: 16, borderWidth: 1, borderColor: L.inputBorder, padding: 12, marginHorizontal: 12, marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="trending-up" size={16} color={L.gold} />
                            <Text style={{ color: L.textPrimary, fontSize: 12, fontWeight: '900' }}>Markup Configs</Text>
                        </View>
                        
                        <TouchableOpacity 
                            onPress={handleApplyMarkups}
                            disabled={applyingMarkups}
                            style={{ backgroundColor: L.gold, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                        >
                            {applyingMarkups ? <ActivityIndicator size="small" color="#020617" /> : <Ionicons name="flash" size={12} color="#020617" />}
                            <Text style={{ color: '#020617', fontSize: 10, fontWeight: '900' }}>
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
                                    <Text style={{ color: L.gold, fontSize: 11, fontWeight: '900', marginTop: 2 }}>
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
                                    backgroundColor: isSelected ? L.gold : L.card, 
                                    borderRadius: 10, 
                                    paddingVertical: 8, 
                                    alignItems: 'center',
                                    borderWidth: 1,
                                    borderColor: isSelected ? L.gold : L.inputBorder
                                }}
                            >
                                <Text style={{ color: isSelected ? '#020617' : L.textSecondary, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }}>
                                    {net}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Data Plans List */}
                {loading ? (
                    <View style={{ padding: 40, alignItems: 'center' }}>
                        <ActivityIndicator size="large" color={L.gold} />
                        <Text style={{ color: L.textMuted, fontSize: 11, marginTop: 8 }}>Loading {selectedNetwork.toUpperCase()} data tariffs...</Text>
                    </View>
                ) : (
                    <View style={{ paddingHorizontal: 12, gap: 8 }}>
                        {plans.map((plan) => {
                            const cost = parseFloat(plan.cost_price || '0');
                            const selling = parseFloat(plan.selling_price || '0');
                            const profit = selling - cost;

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
                                        justifyContent: 'space-between'
                                    }}
                                >
                                    <View style={{ flex: 1, paddingRight: 8 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                            <Text style={{ color: L.textPrimary, fontSize: 12.5, fontWeight: '900' }}>
                                                {plan.name}
                                            </Text>
                                            <View style={{ backgroundColor: L.goldBg, paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 6 }}>
                                                <Text style={{ color: L.gold, fontSize: 8.5, fontWeight: '900', textTransform: 'uppercase' }}>
                                                    {plan.size || plan.network}
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
                                            }}
                                            style={{ backgroundColor: L.goldBg, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: L.gold }}
                                        >
                                            <Text style={{ color: L.gold, fontSize: 10, fontWeight: '900' }}>Edit ✏️</Text>
                                        </TouchableOpacity>

                                        <Switch
                                            trackColor={{ false: '#334155', true: '#059669' }}
                                            thumbColor={plan.is_active ? L.emerald : L.textMuted}
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
                                    No data plans found for {selectedNetwork.toUpperCase()}. Click "Sync All" above.
                                </Text>
                            </View>
                        )}
                    </View>
                )}

            </ScrollView>

            {/* EDIT SELLING PRICE MODAL */}
            {editingPlan && (
                <Modal visible={true} transparent={true} animationType="fade">
                    <View style={{ flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.85)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
                        <View style={{ width: '100%', maxWidth: 420, backgroundColor: L.card, borderRadius: 20, borderWidth: 1.5, borderColor: L.gold, padding: 18 }}>
                            <Text style={{ color: L.textPrimary, fontSize: 14, fontWeight: '900', marginBottom: 2 }}>Edit Selling Price</Text>
                            <Text style={{ color: L.textMuted, fontSize: 10, marginBottom: 12 }}>{editingPlan.name}</Text>
                            
                            <View style={{ backgroundColor: L.bg, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: L.inputBorder, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <Text style={{ color: L.textMuted, fontSize: 10, fontWeight: '700' }}>API COST PRICE</Text>
                                <Text style={{ color: L.gold, fontSize: 12, fontWeight: '900' }}>₦{editingPlan.cost_price}</Text>
                            </View>

                            <Text style={{ color: L.gold, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginBottom: 6 }}>
                                New Selling Price (₦)
                            </Text>
                            <TextInput 
                                style={{ 
                                    backgroundColor: L.bg, 
                                    borderWidth: 1.5, 
                                    borderColor: L.gold, 
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
                                autoFocus
                            />

                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <TouchableOpacity 
                                    style={{ flex: 1, backgroundColor: L.bg, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: L.inputBorder }}
                                    onPress={() => setEditingPlan(null)}
                                >
                                    <Text style={{ color: L.textMuted, fontWeight: '800', fontSize: 11 }}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={{ flex: 1.5, backgroundColor: L.gold, borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' }}
                                    onPress={handleUpdatePrice}
                                >
                                    <Text style={{ color: '#020617', fontWeight: '900', fontSize: 11 }}>Save Price 💾</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}

            {/* EDIT MARKUP CONFIG MODAL */}
            {editingConfig && (
                <Modal visible={true} transparent={true} animationType="fade">
                    <View style={{ flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.85)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
                        <View style={{ width: '100%', maxWidth: 420, backgroundColor: L.card, borderRadius: 20, borderWidth: 1.5, borderColor: L.gold, padding: 18 }}>
                            <Text style={{ color: L.textPrimary, fontSize: 14, fontWeight: '900', marginBottom: 2 }}>
                                Markup Config ({editingConfig.network.toUpperCase()})
                            </Text>
                            <Text style={{ color: L.textMuted, fontSize: 10, marginBottom: 12 }}>
                                Set default profit markup for all {editingConfig.network.toUpperCase()} plans.
                            </Text>
                            
                            <Text style={{ color: L.gold, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginBottom: 6 }}>
                                Markup Type
                            </Text>
                            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                                <TouchableOpacity 
                                    onPress={() => setNewMarkupType('fixed')}
                                    style={{
                                        flex: 1,
                                        backgroundColor: newMarkupType === 'fixed' ? L.gold : L.bg,
                                        borderRadius: 10,
                                        paddingVertical: 8,
                                        alignItems: 'center',
                                        borderWidth: 1,
                                        borderColor: newMarkupType === 'fixed' ? L.gold : L.inputBorder
                                    }}
                                >
                                    <Text style={{ color: newMarkupType === 'fixed' ? '#020617' : L.textSecondary, fontSize: 11, fontWeight: '900' }}>
                                        Fixed (₦)
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    onPress={() => setNewMarkupType('percentage')}
                                    style={{
                                        flex: 1,
                                        backgroundColor: newMarkupType === 'percentage' ? L.gold : L.bg,
                                        borderRadius: 10,
                                        paddingVertical: 8,
                                        alignItems: 'center',
                                        borderWidth: 1,
                                        borderColor: newMarkupType === 'percentage' ? L.gold : L.inputBorder
                                    }}
                                >
                                    <Text style={{ color: newMarkupType === 'percentage' ? '#020617' : L.textSecondary, fontSize: 11, fontWeight: '900' }}>
                                        Percentage (%)
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={{ color: L.gold, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginBottom: 6 }}>
                                {newMarkupType === 'percentage' ? 'Markup Percentage (%)' : 'Markup Amount (₦)'}
                            </Text>
                            <TextInput 
                                style={{ 
                                    backgroundColor: L.bg, 
                                    borderWidth: 1.5, 
                                    borderColor: L.gold, 
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
                                    style={{ flex: 1.5, backgroundColor: L.gold, borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' }}
                                    onPress={handleUpdateConfig}
                                >
                                    <Text style={{ color: '#020617', fontWeight: '900', fontSize: 11 }}>Save Config 💾</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}

        </View>
    );
}
