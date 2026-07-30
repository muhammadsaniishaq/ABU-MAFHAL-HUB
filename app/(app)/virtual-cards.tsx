import { 
    View, 
    Text, 
    TouchableOpacity, 
    ScrollView, 
    Image, 
    ActivityIndicator, 
    Alert, 
    Modal, 
    TextInput, 
    Dimensions,
    Platform 
} from 'react-native';
import { useAppSettings } from '../../hooks/useAppSettings';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { payvesselCardService, VirtualCard } from '../../services/payvesselCards';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const { width: W } = Dimensions.get('window');

export default function VirtualCardsScreen() {
    const { settings } = useAppSettings();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [cards, setCards] = useState<VirtualCard[]>([]);
    const [selectedCard, setSelectedCard] = useState<VirtualCard | null>(null);
    const [showFullDetails, setShowFullDetails] = useState(false);
    const [walletBalance, setWalletBalance] = useState(0);

    // Modals
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showFundModal, setShowFundModal] = useState(false);
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [showAddressModal, setShowAddressModal] = useState(false);

    // Creation Form State
    const [cardCurrency, setCardCurrency] = useState<'USD' | 'NGN'>('USD');
    const [cardHolderName, setCardHolderName] = useState('');
    const [initialFundAmount, setInitialFundAmount] = useState('10'); // $10 initial

    // Fund / Withdraw Amount
    const [fundAmountInput, setFundAmountInput] = useState('');
    const [withdrawAmountInput, setWithdrawAmountInput] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // Fetch User Profile
                const { data: profile } = await supabase.from('profiles').select('balance, full_name').eq('id', user.id).single();
                if (profile) {
                    setWalletBalance(Number(profile.balance) || 0);
                    if (!cardHolderName && profile.full_name) setCardHolderName(profile.full_name);
                }

                // Fetch User Cards
                const userCards = await payvesselCardService.getUserCards(user.id);
                setCards(userCards);
                if (userCards.length > 0) {
                    setSelectedCard(userCards[0]);
                }
            }
        } catch (e: any) {
            console.error('Error loading card data:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateCard = async () => {
        const fundNum = Number(initialFundAmount) || 0;
        if (fundNum < 5 && cardCurrency === 'USD') {
            return Alert.alert('Minimum Funding', 'Minimum initial funding for USD Virtual Card is $5');
        }

        try {
            setActionLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User session not found.');

            const createdCard = await payvesselCardService.createVirtualCard({
                userId: user.id,
                cardHolderName: cardHolderName.trim() || 'ABU MAFHAL USER',
                currency: cardCurrency,
                initialFundingAmount: fundNum
            });

            if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Card Issued 🎉', `Your Payvessel Virtual ${cardCurrency} Card has been successfully created!`);
            
            setShowCreateModal(false);
            loadData();
        } catch (e: any) {
            Alert.alert('Card Creation Failed ❌', e.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleFundCard = async () => {
        const amount = Number(fundAmountInput);
        if (!amount || amount <= 0) return Alert.alert('Invalid Amount', 'Please enter a valid funding amount.');
        if (!selectedCard) return;

        try {
            setActionLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            await payvesselCardService.fundCard({
                cardDbId: selectedCard.id,
                userId: user.id,
                amount: amount,
                currency: selectedCard.currency
            });

            if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Card Funded 🎉', `${selectedCard.currency === 'USD' ? '$' : '₦'}${amount} added to your card!`);
            setShowFundModal(false);
            setFundAmountInput('');
            loadData();
        } catch (e: any) {
            Alert.alert('Funding Error ❌', e.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleWithdrawFromCard = async () => {
        const amount = Number(withdrawAmountInput);
        if (!amount || amount <= 0) return Alert.alert('Invalid Amount', 'Please enter a valid amount.');
        if (!selectedCard) return;

        try {
            setActionLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            await payvesselCardService.withdrawFromCard({
                cardDbId: selectedCard.id,
                userId: user.id,
                amount: amount,
                currency: selectedCard.currency
            });

            if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Withdrawn Successfully 💸', `${selectedCard.currency === 'USD' ? '$' : '₦'}${amount} transferred back to your main wallet!`);
            setShowWithdrawModal(false);
            setWithdrawAmountInput('');
            loadData();
        } catch (e: any) {
            Alert.alert('Withdrawal Error ❌', e.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleToggleFreeze = async () => {
        if (!selectedCard) return;
        try {
            setActionLoading(true);
            const newStatus = await payvesselCardService.toggleFreezeCard(selectedCard.id, selectedCard.status);
            setSelectedCard(prev => prev ? { ...prev, status: newStatus as any } : null);
            setCards(prev => prev.map(c => c.id === selectedCard.id ? { ...c, status: newStatus as any } : c));
            Alert.alert('Security Status Updated 🛡️', `Card is now ${newStatus.toUpperCase()}`);
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleTerminateCard = async () => {
        if (!selectedCard) return;

        Alert.alert(
            'Terminate Card ⚠️',
            'Are you sure you want to terminate this virtual card? Any remaining balance will be refunded immediately to your main wallet.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Terminate & Refund',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setActionLoading(true);
                            const { data: { user } } = await supabase.auth.getUser();
                            if (!user) return;

                            await payvesselCardService.terminateCard(selectedCard.id, user.id, selectedCard.currency);
                            Alert.alert('Card Terminated 🗑️', 'Card closed and remaining balance refunded to your wallet.');
                            loadData();
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

    return (
        <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
            <Stack.Screen options={{ title: 'Payvessel Virtual Cards', headerTintColor: '#fff', headerStyle: { backgroundColor: '#0f172a' }, headerTitleStyle: { color: 'white', fontWeight: 'bold' } }} />
            <StatusBar style="light" />

            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#f5a623" />
                    <Text style={{ color: '#94a3b8', marginTop: 12, fontSize: 12 }}>Loading Virtual Cards...</Text>
                </View>
            ) : cards.length > 0 && selectedCard ? (
                <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                    
                    {/* Wallet Balance Bar */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 20 }}>
                        <View>
                            <Text style={{ color: '#94a3b8', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>Main Wallet Balance</Text>
                            <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '900', marginTop: 2 }}>₦{walletBalance.toLocaleString()}</Text>
                        </View>
                        <TouchableOpacity 
                            onPress={() => setShowCreateModal(true)}
                            style={{ backgroundColor: '#f5a623', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                        >
                            <Ionicons name="add-circle" size={16} color="#0f172a" />
                            <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 11 }}>+ New Card</Text>
                        </TouchableOpacity>
                    </View>

                    {/* LUXURY VIRTUAL CARD VISUAL */}
                    <LinearGradient
                        colors={selectedCard.currency === 'USD' ? ['#1e1b4b', '#312e81', '#0f172a'] : ['#451a03', '#7c2d12', '#0f172a']}
                        style={{
                            width: '100%',
                            aspectRatio: 1.586,
                            borderRadius: 24,
                            padding: 24,
                            justifyContent: 'space-between',
                            marginBottom: 20,
                            borderWidth: 1,
                            borderColor: selectedCard.status === 'frozen' ? '#ef4444' : 'rgba(255,255,255,0.2)',
                            position: 'relative',
                            overflow: 'hidden',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 10 },
                            shadowOpacity: 0.4,
                            shadowRadius: 15,
                            elevation: 10
                        }}
                    >
                        {/* Background Mesh */}
                        <View style={{ position: 'absolute', top: -30, right: -30, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(245, 166, 35, 0.15)' }} />

                        {/* Top Row: Brand & Status */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
                                    <Text style={{ color: '#f5a623', fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>PAYVESSEL CARD</Text>
                                </View>
                                <View style={{ backgroundColor: selectedCard.status === 'active' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: selectedCard.status === 'active' ? '#22c55e' : '#ef4444' }}>
                                    <Text style={{ color: selectedCard.status === 'active' ? '#4ade80' : '#f87171', fontSize: 9, fontWeight: '900' }}>
                                        {selectedCard.status.toUpperCase()}
                                    </Text>
                                </View>
                            </View>
                            <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 22, fontStyle: 'italic' }}>{selectedCard.card_type}</Text>
                        </View>

                        {/* Chip & Wireless */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, zIndex: 10 }}>
                            <View style={{ width: 42, height: 30, borderRadius: 6, backgroundColor: '#f5a623', opacity: 0.8, borderWidth: 1, borderColor: '#fde68a' }} />
                            <Ionicons name="wifi-outline" size={22} color="#ffffff" style={{ opacity: 0.6 }} />
                        </View>

                        {/* 16-Digit Card Number */}
                        <View style={{ zIndex: 10 }}>
                            <Text style={{ color: '#ffffff', fontSize: 20, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', letterSpacing: 2, fontWeight: 'bold' }}>
                                {showFullDetails ? (selectedCard.card_number_full || selectedCard.card_number_masked) : selectedCard.card_number_masked}
                            </Text>
                        </View>

                        {/* Bottom Info: Holder Name & Expiry / CVV */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', zIndex: 10 }}>
                            <View>
                                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 8, fontWeight: '800', textTransform: 'uppercase' }}>Card Holder</Text>
                                <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 14, marginTop: 2 }}>{selectedCard.card_holder_name}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 16 }}>
                                <View>
                                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 8, fontWeight: '800', textTransform: 'uppercase' }}>Expires</Text>
                                    <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 14, marginTop: 2 }}>{selectedCard.expiry_month}/{selectedCard.expiry_year}</Text>
                                </View>
                                <View>
                                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 8, fontWeight: '800', textTransform: 'uppercase' }}>CVV</Text>
                                    <Text style={{ color: '#f5a623', fontWeight: '800', fontSize: 14, marginTop: 2 }}>
                                        {showFullDetails ? (selectedCard.cvv || '882') : '•••'}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </LinearGradient>

                    {/* Card Balance Header */}
                    <View style={{ backgroundColor: '#1e293b', borderRadius: 20, padding: 18, marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#334155' }}>
                        <View>
                            <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '700' }}>CARD AVAILABLE BALANCE</Text>
                            <Text style={{ color: '#ffffff', fontSize: 28, fontWeight: '900', marginTop: 2 }}>
                                {selectedCard.currency === 'USD' ? '$' : '₦'}{selectedCard.balance.toFixed(2)}
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => setShowFullDetails(!showFullDetails)}
                            style={{ backgroundColor: 'rgba(245, 166, 35, 0.15)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#f5a623', flexDirection: 'row', alignItems: 'center', gap: 6 }}
                        >
                            <Ionicons name={showFullDetails ? "eye-off-outline" : "eye-outline"} size={16} color="#f5a623" />
                            <Text style={{ color: '#f5a623', fontWeight: '800', fontSize: 11 }}>
                                {showFullDetails ? 'Mask Details' : 'Reveal Details'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* CARD QUICK ACTIONS GRID */}
                    <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 14, textTransform: 'uppercase', marginBottom: 12, letterSpacing: 1 }}>Card Actions & Security</Text>
                    
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
                        <TouchableOpacity 
                            onPress={() => setShowFundModal(true)}
                            style={{ flex: 1, minWidth: '45%', backgroundColor: '#10b981', padding: 14, borderRadius: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                        >
                            <Ionicons name="card-outline" size={18} color="#ffffff" />
                            <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 13 }}>+ Fund Card</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={() => setShowWithdrawModal(true)}
                            style={{ flex: 1, minWidth: '45%', backgroundColor: '#3b82f6', padding: 14, borderRadius: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                        >
                            <Ionicons name="wallet-outline" size={18} color="#ffffff" />
                            <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 13 }}>💸 Withdraw</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={handleToggleFreeze}
                            style={{ flex: 1, minWidth: '45%', backgroundColor: selectedCard.status === 'active' ? '#ef4444' : '#22c55e', padding: 14, borderRadius: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                        >
                            <Ionicons name={selectedCard.status === 'active' ? "lock-closed-outline" : "lock-open-outline"} size={18} color="#ffffff" />
                            <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 13 }}>
                                {selectedCard.status === 'active' ? 'Freeze Card ❄️' : 'Unfreeze Card 🔓'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={() => setShowAddressModal(true)}
                            style={{ flex: 1, minWidth: '45%', backgroundColor: '#334155', padding: 14, borderRadius: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                        >
                            <Ionicons name="location-outline" size={18} color="#ffffff" />
                            <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 13 }}>Billing Address</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Terminate Card Danger Zone */}
                    <TouchableOpacity
                        onPress={handleTerminateCard}
                        style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 1, borderColor: '#ef4444', padding: 14, borderRadius: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                    >
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                        <Text style={{ color: '#ef4444', fontWeight: '800', fontSize: 12 }}>Terminate Card & Refund Balance</Text>
                    </TouchableOpacity>

                </ScrollView>
            ) : (
                /* NO VIRTUAL CARD EMPTY STATE */
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                    <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(245, 166, 35, 0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                        <Ionicons name="card" size={40} color="#f5a623" />
                    </View>
                    <Text style={{ color: '#ffffff', fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 8 }}>Payvessel Virtual Dollar & Naira Cards</Text>
                    <Text style={{ color: '#94a3b8', textAlign: 'center', fontSize: 12, lineHeight: 18, marginBottom: 30, maxWidth: 320 }}>
                        Create a secure virtual dollar or naira card instantly for international payments. Works on Netflix, Amazon, Apple, Google, AI Tools, Spotify, and more.
                    </Text>

                    <TouchableOpacity
                        onPress={() => setShowCreateModal(true)}
                        style={{ width: '100%', backgroundColor: '#f5a623', height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' }}
                    >
                        <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 15 }}>Create Virtual Card ($3 Fee)</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* MODAL 1: CREATE VIRTUAL CARD */}
            <Modal visible={showCreateModal} animationType="slide" transparent presentationStyle="overFullScreen">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: '#1e293b', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, borderWidth: 1, borderColor: '#334155' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '900' }}>Issue Payvessel Virtual Card</Text>
                            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                                <Ionicons name="close-circle" size={24} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>

                        {/* Currency Selection */}
                        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase' }}>Select Card Currency</Text>
                        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                            <TouchableOpacity
                                onPress={() => setCardCurrency('USD')}
                                style={{ flex: 1, padding: 14, borderRadius: 14, backgroundColor: cardCurrency === 'USD' ? '#f5a623' : '#0f172a', alignItems: 'center', borderWidth: 1, borderColor: '#f5a623' }}
                            >
                                <Text style={{ color: cardCurrency === 'USD' ? '#0f172a' : '#ffffff', fontWeight: '900', fontSize: 14 }}>🇺🇸 USD Dollar Card</Text>
                                <Text style={{ color: cardCurrency === 'USD' ? '#0f172a' : '#94a3b8', fontSize: 9, marginTop: 2 }}>For International Payments</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setCardCurrency('NGN')}
                                style={{ flex: 1, padding: 14, borderRadius: 14, backgroundColor: cardCurrency === 'NGN' ? '#f5a623' : '#0f172a', alignItems: 'center', borderWidth: 1, borderColor: '#f5a623' }}
                            >
                                <Text style={{ color: cardCurrency === 'NGN' ? '#0f172a' : '#ffffff', fontWeight: '900', fontSize: 14 }}>🇳🇬 NGN Naira Card</Text>
                                <Text style={{ color: cardCurrency === 'NGN' ? '#0f172a' : '#94a3b8', fontSize: 9, marginTop: 2 }}>For Local Merchant Bills</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Initial Funding Amount */}
                        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '800', marginBottom: 6, textTransform: 'uppercase' }}>Initial Funding Amount ({cardCurrency})</Text>
                        <TextInput
                            style={{ backgroundColor: '#0f172a', color: '#ffffff', padding: 14, borderRadius: 14, fontSize: 16, fontWeight: 'bold', borderWidth: 1, borderColor: '#334155', marginBottom: 16 }}
                            placeholder="Enter amount (e.g. 10)"
                            placeholderTextColor="#64748b"
                            keyboardType="numeric"
                            value={initialFundAmount}
                            onChangeText={setInitialFundAmount}
                        />

                        {/* Fee Breakdown */}
                        <View style={{ backgroundColor: '#0f172a', padding: 12, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#334155' }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                                <Text style={{ color: '#94a3b8', fontSize: 11 }}>Card Creation Fee</Text>
                                <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: 'bold' }}>$3.00 (₦4,800)</Text>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                                <Text style={{ color: '#94a3b8', fontSize: 11 }}>Initial Card Funding</Text>
                                <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: 'bold' }}>{cardCurrency === 'USD' ? '$' : '₦'}{initialFundAmount || 0}</Text>
                            </View>
                            <View style={{ height: 1, backgroundColor: '#334155', marginVertical: 6 }} />
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ color: '#f5a623', fontSize: 12, fontWeight: '900' }}>Total Wallet Charge</Text>
                                <Text style={{ color: '#f5a623', fontSize: 12, fontWeight: '900' }}>
                                    ₦{((3 + (Number(initialFundAmount) || 0)) * 1600).toLocaleString()}
                                </Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            onPress={handleCreateCard}
                            disabled={actionLoading}
                            style={{ backgroundColor: '#f5a623', height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center' }}
                        >
                            {actionLoading ? <ActivityIndicator color="#0f172a" /> : <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 15 }}>Issue Card Instantly 💳</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* MODAL 2: FUND CARD */}
            <Modal visible={showFundModal} animationType="slide" transparent presentationStyle="overFullScreen">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: '#1e293b', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, borderWidth: 1, borderColor: '#334155' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '900' }}>+ Fund Virtual Card</Text>
                            <TouchableOpacity onPress={() => setShowFundModal(false)}>
                                <Ionicons name="close-circle" size={24} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ color: '#94a3b8', fontSize: 11, marginBottom: 8 }}>Enter amount in {selectedCard?.currency} to add to your card balance.</Text>
                        <TextInput
                            style={{ backgroundColor: '#0f172a', color: '#ffffff', padding: 14, borderRadius: 14, fontSize: 18, fontWeight: 'bold', borderWidth: 1, borderColor: '#334155', marginBottom: 16 }}
                            placeholder={`Amount (${selectedCard?.currency})`}
                            placeholderTextColor="#64748b"
                            keyboardType="numeric"
                            value={fundAmountInput}
                            onChangeText={setFundAmountInput}
                        />

                        {selectedCard && (
                            <Text style={{ color: '#f5a623', fontSize: 11, fontWeight: 'bold', marginBottom: 20 }}>
                                Equivalent Wallet Charge: ₦{((Number(fundAmountInput) || 0) * (selectedCard.currency === 'USD' ? 1600 : 1)).toLocaleString()}
                            </Text>
                        )}

                        <TouchableOpacity
                            onPress={handleFundCard}
                            disabled={actionLoading}
                            style={{ backgroundColor: '#10b981', height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center' }}
                        >
                            {actionLoading ? <ActivityIndicator color="#ffffff" /> : <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 15 }}>Confirm Funding 💳</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* MODAL 3: WITHDRAW FROM CARD */}
            <Modal visible={showWithdrawModal} animationType="slide" transparent presentationStyle="overFullScreen">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: '#1e293b', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, borderWidth: 1, borderColor: '#334155' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '900' }}>💸 Withdraw to Main Wallet</Text>
                            <TouchableOpacity onPress={() => setShowWithdrawModal(false)}>
                                <Ionicons name="close-circle" size={24} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ color: '#94a3b8', fontSize: 11, marginBottom: 8 }}>Available Card Balance: {selectedCard?.currency === 'USD' ? '$' : '₦'}{selectedCard?.balance}</Text>
                        <TextInput
                            style={{ backgroundColor: '#0f172a', color: '#ffffff', padding: 14, borderRadius: 14, fontSize: 18, fontWeight: 'bold', borderWidth: 1, borderColor: '#334155', marginBottom: 16 }}
                            placeholder={`Amount (${selectedCard?.currency})`}
                            placeholderTextColor="#64748b"
                            keyboardType="numeric"
                            value={withdrawAmountInput}
                            onChangeText={setWithdrawAmountInput}
                        />

                        <TouchableOpacity
                            onPress={handleWithdrawFromCard}
                            disabled={actionLoading}
                            style={{ backgroundColor: '#3b82f6', height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center' }}
                        >
                            {actionLoading ? <ActivityIndicator color="#ffffff" /> : <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 15 }}>Withdraw to Wallet 💸</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* MODAL 4: BILLING ADDRESS */}
            <Modal visible={showAddressModal} animationType="slide" transparent presentationStyle="overFullScreen">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: '#1e293b', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, borderWidth: 1, borderColor: '#334155' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '900' }}>📍 US Billing Address</Text>
                            <TouchableOpacity onPress={() => setShowAddressModal(false)}>
                                <Ionicons name="close-circle" size={24} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ color: '#94a3b8', fontSize: 11, marginBottom: 16 }}>Use these details when making international online payments (Amazon, Netflix, Apple):</Text>

                        <View style={{ backgroundColor: '#0f172a', padding: 14, borderRadius: 14, gap: 10, borderWidth: 1, borderColor: '#334155', marginBottom: 20 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ color: '#94a3b8', fontSize: 12 }}>Street</Text>
                                <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: 'bold' }}>{selectedCard?.billing_address?.street || '350 Fifth Avenue'}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ color: '#94a3b8', fontSize: 12 }}>City</Text>
                                <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: 'bold' }}>{selectedCard?.billing_address?.city || 'New York'}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ color: '#94a3b8', fontSize: 12 }}>State</Text>
                                <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: 'bold' }}>{selectedCard?.billing_address?.state || 'NY'}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ color: '#94a3b8', fontSize: 12 }}>Zip Code</Text>
                                <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: 'bold' }}>{selectedCard?.billing_address?.zip || '10118'}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ color: '#94a3b8', fontSize: 12 }}>Country</Text>
                                <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: 'bold' }}>United States (US)</Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            onPress={() => setShowAddressModal(false)}
                            style={{ backgroundColor: '#f5a623', height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center' }}
                        >
                            <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 15 }}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

        </View>
    );
}
