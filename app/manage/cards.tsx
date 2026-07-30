import { 
    View, 
    Text, 
    TouchableOpacity, 
    ScrollView, 
    Image, 
    ActivityIndicator, 
    Alert, 
    TextInput, 
    Modal, 
    Switch,
    Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';

export default function CardManager() {
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [cards, setCards] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'frozen' | 'terminated'>('all');

    // Admin Settings Modal
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [payvesselApiKey, setPayvesselApiKey] = useState('');
    const [payvesselSecretKey, setPayvesselSecretKey] = useState('');
    const [payvesselBusinessId, setPayvesselBusinessId] = useState('');
    const [cardCreationFeeUSD, setCardCreationFeeUSD] = useState('3.00');

    useEffect(() => {
        loadAdminCards();
        loadPayvesselConfig();
    }, []);

    const loadPayvesselConfig = async () => {
        try {
            const { data: keyData } = await supabase.from('app_settings').select('value').eq('key', 'payvessel_api_key').single();
            const { data: secData } = await supabase.from('app_settings').select('value').eq('key', 'payvessel_secret_key').single();
            const { data: busData } = await supabase.from('app_settings').select('value').eq('key', 'payvessel_business_id').single();
            const { data: feeData } = await supabase.from('app_settings').select('value').eq('key', 'virtual_card_creation_fee_usd').single();

            if (keyData?.value) setPayvesselApiKey(typeof keyData.value === 'string' ? keyData.value : keyData.value.key || '');
            if (secData?.value) setPayvesselSecretKey(typeof secData.value === 'string' ? secData.value : secData.value.key || '');
            if (busData?.value) setPayvesselBusinessId(typeof busData.value === 'string' ? busData.value : busData.value.id || '');
            if (feeData?.value) setCardCreationFeeUSD(String(feeData.value));
        } catch (e) {}
    };

    const loadAdminCards = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('user_virtual_cards')
                .select('*, profiles(full_name, email, phone_number)')
                .order('created_at', { ascending: false });

            if (!error && data) {
                setCards(data);
            }
        } catch (e: any) {
            console.error('Error fetching admin cards:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveConfig = async () => {
        try {
            setActionLoading(true);
            await supabase.from('app_settings').upsert([
                { key: 'payvessel_api_key', value: payvesselApiKey.trim() },
                { key: 'payvessel_secret_key', value: payvesselSecretKey.trim() },
                { key: 'payvessel_business_id', value: payvesselBusinessId.trim() },
                { key: 'virtual_card_creation_fee_usd', value: cardCreationFeeUSD.trim() }
            ], { onConflict: 'key' });

            Alert.alert('Settings Saved 🎉', 'Payvessel Virtual Card API configuration updated successfully.');
            setShowConfigModal(false);
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleAdminToggleFreeze = async (card: any) => {
        const newStatus = card.status === 'active' ? 'frozen' : 'active';
        try {
            setActionLoading(true);
            await supabase.from('user_virtual_cards').update({ status: newStatus }).eq('id', card.id);
            setCards(prev => prev.map(c => c.id === card.id ? { ...c, status: newStatus } : c));
            Alert.alert('Card Status Updated 🛡️', `Card status changed to ${newStatus.toUpperCase()}`);
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleAdminTerminateCard = async (card: any) => {
        Alert.alert(
            'Terminate Card ⚠️',
            `Are you sure you want to terminate ${card.card_holder_name}'s card? Remaining balance ($${card.balance}) will be refunded to user wallet.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Terminate Card',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setActionLoading(true);
                            // Refund balance if > 0
                            if (card.balance > 0) {
                                const refundNGN = card.currency === 'USD' ? card.balance * 1600 : card.balance;
                                const { data: profile } = await supabase.from('profiles').select('balance').eq('id', card.user_id).single();
                                if (profile) {
                                    await supabase.from('profiles').update({ balance: (Number(profile.balance) || 0) + refundNGN }).eq('id', card.user_id);
                                }
                            }
                            await supabase.from('user_virtual_cards').update({ status: 'terminated', balance: 0 }).eq('id', card.id);
                            loadAdminCards();
                            Alert.alert('Card Terminated 🗑️', 'Card closed and balance refunded.');
                        } catch (e: any) {
                            Alert.alert('Error', e.message);
                        } finally {
                            setActionLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const filteredCards = cards.filter(c => {
        const matchesStatus = activeFilter === 'all' || c.status === activeFilter;
        const matchesQuery = !searchQuery || 
            c.card_holder_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.card_number_masked?.includes(searchQuery) ||
            c.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesStatus && matchesQuery;
    });

    const activeCount = cards.filter(c => c.status === 'active').length;
    const frozenCount = cards.filter(c => c.status === 'frozen').length;
    const totalBalance = cards.reduce((acc, c) => acc + (Number(c.balance) || 0), 0);

    return (
        <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
            <Stack.Screen options={{
                title: 'Payvessel Virtual Cards Manager',
                headerStyle: { backgroundColor: '#0f172a' },
                headerTintColor: '#fff',
                headerTitleStyle: { color: 'white', fontWeight: 'bold' }
            }} />

            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                
                {/* Header Title & Config Button */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <View>
                        <Text style={{ fontSize: 22, fontWeight: '900', color: '#ffffff' }}>Issued Virtual Cards</Text>
                        <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Payvessel API Engine & Merchant Controls</Text>
                    </View>

                    <TouchableOpacity 
                        onPress={() => setShowConfigModal(true)}
                        style={{ backgroundColor: '#f5a623', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                    >
                        <Ionicons name="key-outline" size={16} color="#0f172a" />
                        <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 11 }}>API Config</Text>
                    </TouchableOpacity>
                </View>

                {/* Metric Summary Cards */}
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                    <View style={{ flex: 1, backgroundColor: '#1e293b', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#334155' }}>
                        <Text style={{ color: '#94a3b8', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' }}>Total Issued</Text>
                        <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '900', marginTop: 2 }}>{cards.length}</Text>
                    </View>

                    <View style={{ flex: 1, backgroundColor: '#1e293b', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#334155' }}>
                        <Text style={{ color: '#4ade80', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' }}>Active Cards</Text>
                        <Text style={{ color: '#4ade80', fontSize: 20, fontWeight: '900', marginTop: 2 }}>{activeCount}</Text>
                    </View>

                    <View style={{ flex: 1, backgroundColor: '#1e293b', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#334155' }}>
                        <Text style={{ color: '#f5a623', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' }}>Float Balance</Text>
                        <Text style={{ color: '#f5a623', fontSize: 18, fontWeight: '900', marginTop: 2 }}>${totalBalance.toFixed(2)}</Text>
                    </View>
                </View>

                {/* Search & Filter Bar */}
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: '#334155', marginBottom: 14, height: 42 }}>
                    <Ionicons name="search-outline" size={18} color="#94a3b8" />
                    <TextInput
                        style={{ flex: 1, marginLeft: 8, color: '#ffffff', fontSize: 12 }}
                        placeholder="Search card by holder name, email, or number..."
                        placeholderTextColor="#64748b"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                {/* Filter Chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        {(['all', 'active', 'frozen', 'terminated'] as const).map(f => (
                            <TouchableOpacity
                                key={f}
                                onPress={() => setActiveFilter(f)}
                                style={{
                                    paddingHorizontal: 14,
                                    paddingVertical: 6,
                                    borderRadius: 20,
                                    backgroundColor: activeFilter === f ? '#f5a623' : '#1e293b',
                                    borderWidth: 1,
                                    borderColor: activeFilter === f ? '#f5a623' : '#334155'
                                }}
                            >
                                <Text style={{ color: activeFilter === f ? '#0f172a' : '#94a3b8', fontWeight: '900', fontSize: 10, textTransform: 'uppercase' }}>
                                    {f}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>

                {/* Cards List */}
                {loading ? (
                    <ActivityIndicator size="large" color="#f5a623" style={{ marginTop: 40 }} />
                ) : filteredCards.length === 0 ? (
                    <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 40 }}>
                        <Ionicons name="card-outline" size={48} color="#334155" />
                        <Text style={{ color: '#64748b', marginTop: 10, fontWeight: 'bold' }}>No virtual cards found</Text>
                    </View>
                ) : (
                    filteredCards.map((card) => (
                        <View key={card.id} style={{ backgroundColor: '#1e293b', borderRadius: 20, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#334155' }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(245, 166, 35, 0.15)', justifyContent: 'center', alignItems: 'center' }}>
                                        <Ionicons name="card" size={20} color="#f5a623" />
                                    </View>
                                    <View>
                                        <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 14 }}>{card.card_holder_name}</Text>
                                        <Text style={{ color: '#94a3b8', fontSize: 11 }}>{card.profiles?.email || 'User'}</Text>
                                    </View>
                                </View>

                                <View style={{ backgroundColor: card.status === 'active' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: card.status === 'active' ? '#22c55e' : '#ef4444' }}>
                                    <Text style={{ color: card.status === 'active' ? '#4ade80' : '#f87171', fontSize: 9, fontWeight: '900' }}>
                                        {card.status.toUpperCase()}
                                    </Text>
                                </View>
                            </View>

                            <View style={{ backgroundColor: '#0f172a', padding: 12, borderRadius: 12, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <View>
                                    <Text style={{ color: '#64748b', fontSize: 9, fontWeight: '800' }}>CARD NUMBER</Text>
                                    <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginTop: 2 }}>
                                        {card.card_number_masked}
                                    </Text>
                                </View>

                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={{ color: '#64748b', fontSize: 9, fontWeight: '800' }}>BALANCE</Text>
                                    <Text style={{ color: '#f5a623', fontSize: 14, fontWeight: '900', marginTop: 2 }}>
                                        {card.currency === 'USD' ? '$' : '₦'}{card.balance}
                                    </Text>
                                </View>
                            </View>

                            {/* Admin Action Buttons */}
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TouchableOpacity
                                    onPress={() => handleAdminToggleFreeze(card)}
                                    style={{ flex: 1, backgroundColor: card.status === 'active' ? '#ef4444' : '#22c55e', paddingVertical: 8, borderRadius: 10, alignItems: 'center' }}
                                >
                                    <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 11 }}>
                                        {card.status === 'active' ? 'Freeze Card ❄️' : 'Unfreeze Card 🔓'}
                                    </Text>
                                </TouchableOpacity>

                                {card.status !== 'terminated' && (
                                    <TouchableOpacity
                                        onPress={() => handleAdminTerminateCard(card)}
                                        style={{ flex: 1, backgroundColor: '#334155', paddingVertical: 8, borderRadius: 10, alignItems: 'center' }}
                                    >
                                        <Text style={{ color: '#f87171', fontWeight: '800', fontSize: 11 }}>Terminate 🗑️</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    ))
                )}
            </ScrollView>

            {/* PAYVESSEL API CONFIG MODAL */}
            <Modal visible={showConfigModal} animationType="slide" transparent presentationStyle="overFullScreen">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: '#1e293b', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, borderWidth: 1, borderColor: '#334155' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '900' }}>Payvessel API & Card Setup</Text>
                            <TouchableOpacity onPress={() => setShowConfigModal(false)}>
                                <Ionicons name="close-circle" size={24} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ color: '#94a3b8', fontSize: 11, marginBottom: 12 }}>Configure Payvessel API Credentials for virtual account & virtual card issuance:</Text>

                        <Text style={{ color: '#94a3b8', fontSize: 10, fontWeight: '800', marginBottom: 4 }}>Payvessel API Key</Text>
                        <TextInput
                            style={{ backgroundColor: '#0f172a', color: '#ffffff', padding: 12, borderRadius: 12, fontSize: 12, marginBottom: 10, borderWidth: 1, borderColor: '#334155' }}
                            placeholder="PV_API_KEY_..."
                            placeholderTextColor="#64748b"
                            value={payvesselApiKey}
                            onChangeText={setPayvesselApiKey}
                        />

                        <Text style={{ color: '#94a3b8', fontSize: 10, fontWeight: '800', marginBottom: 4 }}>Payvessel Secret Key</Text>
                        <TextInput
                            style={{ backgroundColor: '#0f172a', color: '#ffffff', padding: 12, borderRadius: 12, fontSize: 12, marginBottom: 10, borderWidth: 1, borderColor: '#334155' }}
                            placeholder="PV_SECRET_KEY_..."
                            placeholderTextColor="#64748b"
                            value={payvesselSecretKey}
                            onChangeText={setPayvesselSecretKey}
                            secureTextEntry
                        />

                        <Text style={{ color: '#94a3b8', fontSize: 10, fontWeight: '800', marginBottom: 4 }}>Payvessel Business ID</Text>
                        <TextInput
                            style={{ backgroundColor: '#0f172a', color: '#ffffff', padding: 12, borderRadius: 12, fontSize: 12, marginBottom: 10, borderWidth: 1, borderColor: '#334155' }}
                            placeholder="PV_BIZ_ID_..."
                            placeholderTextColor="#64748b"
                            value={payvesselBusinessId}
                            onChangeText={setPayvesselBusinessId}
                        />

                        <Text style={{ color: '#94a3b8', fontSize: 10, fontWeight: '800', marginBottom: 4 }}>Virtual Card Creation Fee (USD $)</Text>
                        <TextInput
                            style={{ backgroundColor: '#0f172a', color: '#ffffff', padding: 12, borderRadius: 12, fontSize: 12, marginBottom: 14, borderWidth: 1, borderColor: '#334155' }}
                            placeholder="3.00"
                            placeholderTextColor="#64748b"
                            keyboardType="numeric"
                            value={cardCreationFeeUSD}
                            onChangeText={setCardCreationFeeUSD}
                        />

                        {/* Commercial Rates Summary Banner */}
                        <View style={{ backgroundColor: '#0f172a', padding: 12, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#334155' }}>
                            <Text style={{ color: '#f5a623', fontSize: 11, fontWeight: '900', marginBottom: 6 }}>📜 Payvessel Rates (ABU MAFHAL LTD Proposal):</Text>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                                <Text style={{ color: '#94a3b8', fontSize: 10 }}>• Card Issuance Wholesale Cost:</Text>
                                <Text style={{ color: '#4ade80', fontSize: 10, fontWeight: 'bold' }}>$1.50 / card</Text>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                                <Text style={{ color: '#94a3b8', fontSize: 10 }}>• Apple/Google Pay Contactless:</Text>
                                <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: 'bold' }}>$2.50 / card</Text>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                                <Text style={{ color: '#94a3b8', fontSize: 10 }}>• Monthly & API Access Fees:</Text>
                                <Text style={{ color: '#4ade80', fontSize: 10, fontWeight: 'bold' }}>WAIVED ($0)</Text>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ color: '#94a3b8', fontSize: 10 }}>• Individual Card Funding Fee:</Text>
                                <Text style={{ color: '#4ade80', fontSize: 10, fontWeight: 'bold' }}>NO FEE ($0)</Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            onPress={handleSaveConfig}
                            disabled={actionLoading}
                            style={{ backgroundColor: '#f5a623', height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center' }}
                        >
                            {actionLoading ? <ActivityIndicator color="#0f172a" /> : <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 15 }}>Save Configuration 💾</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

        </View>
    );
}
