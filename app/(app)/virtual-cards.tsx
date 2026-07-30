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
    Platform,
    Switch 
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

const SUPPORTED_MERCHANTS = [
    { name: 'Netflix', icon: 'logo-netflix', color: '#E50914' },
    { name: 'Amazon', icon: 'logo-amazon', color: '#FF9900' },
    { name: 'Apple', icon: 'logo-apple', color: '#000000' },
    { name: 'Google Play', icon: 'logo-google', color: '#4285F4' },
    { name: 'ChatGPT AI', icon: 'sparkles', color: '#10A37F' },
    { name: 'Spotify', icon: 'musical-notes', color: '#1DB954' },
];

const CARD_SKINS = {
    obsidian: { name: 'Midnight Obsidian 👑', colors: ['#0f172a', '#1e293b', '#0f172a'], text: '#ffffff', accent: '#f5a623' },
    sapphire: { name: 'Royal Sapphire 💎', colors: ['#1e1b4b', '#312e81', '#1e1b4b'], text: '#ffffff', accent: '#60a5fa' },
    rose_gold: { name: 'Rose Gold Pearl 🌸', colors: ['#881337', '#be123c', '#4c0519'], text: '#ffffff', accent: '#f472b6' },
    emerald: { name: 'Emerald Cyber ⚡', colors: ['#064e3b', '#047857', '#022c22'], text: '#ffffff', accent: '#34d399' },
};

export default function VirtualCardsScreen() {
    const { settings } = useAppSettings();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [cards, setCards] = useState<VirtualCard[]>([]);
    const [selectedCard, setSelectedCard] = useState<VirtualCard | null>(null);
    const [showFullDetails, setShowFullDetails] = useState(false);
    const [walletBalance, setWalletBalance] = useState(0);

    // Dynamic Exchange Rate
    const usdRate = Number(settings?.usd_exchange_rate) || 1600;

    // Selected Card Skin
    const [activeSkin, setActiveSkin] = useState<'obsidian' | 'sapphire' | 'rose_gold' | 'emerald'>('obsidian');

    // Modals
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showFundModal, setShowFundModal] = useState(false);
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [showAddressModal, setShowAddressModal] = useState(false);
    const [showControlsModal, setShowControlsModal] = useState(false);
    const [showStatementModal, setShowStatementModal] = useState(false);

    // Card Controls & Limits State
    const [monthlySpendingLimit, setMonthlySpendingLimit] = useState('1000');
    const [onlineShoppingEnabled, setOnlineShoppingEnabled] = useState(true);
    const [contactlessEnabled, setContactlessEnabled] = useState(true);
    const [internationalEnabled, setInternationalEnabled] = useState(true);

    // Creation Form State
    const [cardCurrency, setCardCurrency] = useState<'USD' | 'NGN'>('USD');
    const [cardHolderName, setCardHolderName] = useState('');
    const [initialFundAmount, setInitialFundAmount] = useState('10');

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
                const { data: profile } = await supabase.from('profiles').select('balance, full_name').eq('id', user.id).single();
                if (profile) {
                    setWalletBalance(Number(profile.balance) || 0);
                    if (!cardHolderName && profile.full_name) setCardHolderName(profile.full_name);
                }

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

    // Calculate Wallet Charge Accurately
    const calcCreationWalletCharge = () => {
        const creationFeeUSD = 3.0; // $3.00 Creation Fee
        const creationFeeNGN = creationFeeUSD * usdRate;
        const initialFund = Number(initialFundAmount) || 0;

        let fundChargeNGN = 0;
        if (cardCurrency === 'USD') {
            fundChargeNGN = initialFund * usdRate;
        } else {
            fundChargeNGN = initialFund; // Already in NGN
        }

        return {
            creationFeeUSD,
            creationFeeNGN,
            fundChargeNGN,
            totalNGN: creationFeeNGN + fundChargeNGN
        };
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

            await payvesselCardService.createVirtualCard({
                userId: user.id,
                cardHolderName: cardHolderName.trim() || 'ABU MAFHAL USER',
                currency: cardCurrency,
                initialFundingAmount: fundNum
            });

            if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Virtual Card Created 🎉', `Your Payvessel ${cardCurrency} Virtual Card is now active and ready for online payments!`);
            
            setShowCreateModal(false);
            loadData();
        } catch (e: any) {
            Alert.alert('Creation Failed ❌', e.message);
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
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
            'Terminate Virtual Card ⚠️',
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

    const skinTheme = CARD_SKINS[activeSkin];
    const creationCharges = calcCreationWalletCharge();

    return (
        <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
            <Stack.Screen options={{ 
                title: 'Virtual Cards Studio', 
                headerTintColor: '#0f172a', 
                headerStyle: { backgroundColor: '#ffffff' }, 
                headerTitleStyle: { color: '#0f172a', fontWeight: '900', fontSize: 18 } 
            }} />
            <StatusBar style="dark" />

            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#d97706" />
                    <Text style={{ color: '#64748b', marginTop: 12, fontSize: 12, fontWeight: '700' }}>Loading Virtual Cards Studio...</Text>
                </View>
            ) : cards.length > 0 && selectedCard ? (
                <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 50 }} showsVerticalScrollIndicator={false}>
                    
                    {/* LUXURY ELEGANT TOP HEADER DASHBOARD BAR */}
                    <View style={{ backgroundColor: '#ffffff', borderRadius: 24, padding: 18, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 }}>
                        
                        {/* Live Exchange Rate & Active Card Counter Pill */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                            <View style={{ backgroundColor: '#fffbeb', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: '#fde68a', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={{ fontSize: 11 }}>🇺🇸</Text>
                                <Text style={{ color: '#d97706', fontSize: 10, fontWeight: '900' }}>1 USD = ₦{usdRate.toLocaleString()}</Text>
                            </View>

                            <View style={{ backgroundColor: '#ecfdf5', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: '#a7f3d0', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' }} />
                                <Text style={{ color: '#047857', fontSize: 10, fontWeight: '900' }}>{cards.length} Active Card{cards.length > 1 ? 's' : ''}</Text>
                            </View>
                        </View>

                        {/* Main Wallet Balance Row */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View>
                                <Text style={{ color: '#64748b', fontSize: 9, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>Main Wallet Balance</Text>
                                <Text style={{ color: '#0f172a', fontSize: 22, fontWeight: '900', marginTop: 2 }}>₦{walletBalance.toLocaleString()}</Text>
                            </View>
                            <TouchableOpacity 
                                onPress={() => setShowCreateModal(true)}
                                style={{ backgroundColor: '#0f172a', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 6, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 }}
                            >
                                <Ionicons name="add-circle" size={18} color="#ffffff" />
                                <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 12 }}>+ New Card</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Multiple Cards Switcher Tabs */}
                    {cards.length > 1 && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                {cards.map((c, i) => (
                                    <TouchableOpacity
                                        key={c.id}
                                        onPress={() => {
                                            setSelectedCard(c);
                                            setShowFullDetails(false);
                                        }}
                                        style={{
                                            paddingHorizontal: 14,
                                            paddingVertical: 8,
                                            borderRadius: 16,
                                            backgroundColor: selectedCard.id === c.id ? '#0f172a' : '#ffffff',
                                            borderWidth: 1,
                                            borderColor: selectedCard.id === c.id ? '#0f172a' : '#e2e8f0',
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: 6
                                        }}
                                    >
                                        <Ionicons name="card" size={14} color={selectedCard.id === c.id ? '#ffffff' : '#0f172a'} />
                                        <Text style={{ color: selectedCard.id === c.id ? '#ffffff' : '#0f172a', fontWeight: '900', fontSize: 11 }}>
                                            Card #{i + 1} ({c.currency})
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>
                    )}

                    {/* CARD SKIN CUSTOMIZER SELECTOR */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Choose Card Skin</Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            {(Object.keys(CARD_SKINS) as Array<keyof typeof CARD_SKINS>).map(skinKey => (
                                <TouchableOpacity
                                    key={skinKey}
                                    onPress={() => {
                                        setActiveSkin(skinKey);
                                        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    }}
                                    style={{
                                        width: 22,
                                        height: 22,
                                        borderRadius: 11,
                                        backgroundColor: CARD_SKINS[skinKey].colors[0],
                                        borderWidth: activeSkin === skinKey ? 2 : 0,
                                        borderColor: '#d97706'
                                    }}
                                />
                            ))}
                        </View>
                    </View>

                    {/* ULTRA-LUXURY 3D VIRTUAL CARD VISUAL */}
                    <LinearGradient
                        colors={skinTheme.colors as any}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{
                            width: '100%',
                            aspectRatio: 1.586,
                            borderRadius: 24,
                            padding: 24,
                            justifyContent: 'space-between',
                            marginBottom: 20,
                            borderWidth: 1.5,
                            borderColor: selectedCard.status === 'frozen' ? '#ef4444' : skinTheme.accent,
                            position: 'relative',
                            overflow: 'hidden',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 12 },
                            shadowOpacity: 0.25,
                            shadowRadius: 18,
                            elevation: 10
                        }}
                    >
                        {/* Metallic Watermark */}
                        <View style={{ position: 'absolute', top: -50, right: -50, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255, 255, 255, 0.08)' }} />

                        {/* Top Row: Brand & Status Badge */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.25)' }}>
                                    <Text style={{ color: skinTheme.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 }}>PAYVESSEL SECURE</Text>
                                </View>
                                <View style={{ backgroundColor: selectedCard.status === 'active' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: selectedCard.status === 'active' ? '#22c55e' : '#ef4444', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: selectedCard.status === 'active' ? '#22c55e' : '#ef4444' }} />
                                    <Text style={{ color: selectedCard.status === 'active' ? '#4ade80' : '#f87171', fontSize: 9, fontWeight: '900' }}>
                                        {selectedCard.status.toUpperCase()}
                                    </Text>
                                </View>
                            </View>
                            <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 24, fontStyle: 'italic', letterSpacing: 1 }}>{selectedCard.card_type}</Text>
                        </View>

                        {/* Metallic Chip & Contactless Symbol */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, zIndex: 10 }}>
                            <View style={{ width: 44, height: 32, borderRadius: 7, backgroundColor: skinTheme.accent, borderWidth: 1.5, borderColor: '#fef08a', justifyContent: 'center', paddingHorizontal: 6 }}>
                                <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.3)', marginVertical: 3 }} />
                                <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.3)' }} />
                            </View>
                            <Ionicons name="wifi-outline" size={24} color="#ffffff" style={{ transform: [{ rotate: '90deg' }], opacity: 0.7 }} />
                        </View>

                        {/* 16-Digit Card Number */}
                        <View style={{ zIndex: 10 }}>
                            <Text style={{ color: '#ffffff', fontSize: 21, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', letterSpacing: 2.5, fontWeight: 'bold' }}>
                                {showFullDetails ? (selectedCard.card_number_full || selectedCard.card_number_masked) : selectedCard.card_number_masked}
                            </Text>
                        </View>

                        {/* Bottom Info: Holder Name, Expiry & CVV */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', zIndex: 10 }}>
                            <View>
                                <Text style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 8, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>Card Holder</Text>
                                <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 15, marginTop: 2, letterSpacing: 0.5 }}>{selectedCard.card_holder_name}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 18 }}>
                                <View>
                                    <Text style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 8, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>Expires</Text>
                                    <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 14, marginTop: 2 }}>{selectedCard.expiry_month}/{selectedCard.expiry_year}</Text>
                                </View>
                                <View>
                                    <Text style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 8, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>CVV</Text>
                                    <Text style={{ color: skinTheme.accent, fontWeight: '900', fontSize: 14, marginTop: 2 }}>
                                        {showFullDetails ? (selectedCard.cvv || '882') : '•••'}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </LinearGradient>

                    {/* Card Balance Display Header */}
                    <View style={{ backgroundColor: '#ffffff', borderRadius: 22, padding: 20, marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 }}>
                        <View>
                            <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>Available Card Balance</Text>
                            <Text style={{ color: '#0f172a', fontSize: 32, fontWeight: '900', marginTop: 2 }}>
                                {selectedCard.currency === 'USD' ? '$' : '₦'}{selectedCard.balance.toFixed(2)}
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => {
                                setShowFullDetails(!showFullDetails);
                                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }}
                            style={{ backgroundColor: '#fffbeb', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: '#fde68a', flexDirection: 'row', alignItems: 'center', gap: 6 }}
                        >
                            <Ionicons name={showFullDetails ? "eye-off-outline" : "eye-outline"} size={18} color="#d97706" />
                            <Text style={{ color: '#d97706', fontWeight: '900', fontSize: 12 }}>
                                {showFullDetails ? 'Mask Details' : 'Reveal Details'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* BIG GLOBAL FINTECH APPS CONTROL GRID */}
                    <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 13, textTransform: 'uppercase', marginBottom: 12, letterSpacing: 1.5 }}>Global App Card Controls</Text>
                    
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
                        <TouchableOpacity 
                            onPress={() => setShowFundModal(true)}
                            style={{ flex: 1, minWidth: '45%', backgroundColor: '#10b981', padding: 16, borderRadius: 18, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, shadowColor: '#10b981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 }}
                        >
                            <Ionicons name="card-outline" size={20} color="#ffffff" />
                            <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 13 }}>+ Fund Card</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={() => setShowWithdrawModal(true)}
                            style={{ flex: 1, minWidth: '45%', backgroundColor: '#3b82f6', padding: 16, borderRadius: 18, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 }}
                        >
                            <Ionicons name="wallet-outline" size={20} color="#ffffff" />
                            <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 13 }}>💸 Withdraw</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={() => setShowControlsModal(true)}
                            style={{ flex: 1, minWidth: '45%', backgroundColor: '#0f172a', padding: 16, borderRadius: 18, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                        >
                            <Ionicons name="options-outline" size={20} color="#ffffff" />
                            <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 13 }}>Limits & Controls</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={handleToggleFreeze}
                            style={{ flex: 1, minWidth: '45%', backgroundColor: selectedCard.status === 'active' ? '#ef4444' : '#22c55e', padding: 16, borderRadius: 18, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                        >
                            <Ionicons name={selectedCard.status === 'active' ? "lock-closed-outline" : "lock-open-outline"} size={20} color="#ffffff" />
                            <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 13 }}>
                                {selectedCard.status === 'active' ? 'Freeze Card ❄️' : 'Unfreeze Card 🔓'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={() => setShowAddressModal(true)}
                            style={{ flex: 1, minWidth: '45%', backgroundColor: '#ffffff', padding: 16, borderRadius: 18, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#e2e8f0' }}
                        >
                            <Ionicons name="location-outline" size={20} color="#0f172a" />
                            <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 13 }}>US Address</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={() => setShowStatementModal(true)}
                            style={{ flex: 1, minWidth: '45%', backgroundColor: '#ffffff', padding: 16, borderRadius: 18, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#e2e8f0' }}
                        >
                            <Ionicons name="document-text-outline" size={20} color="#0f172a" />
                            <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 13 }}>Statement Logs</Text>
                        </TouchableOpacity>
                    </View>

                    {/* SUPPORTED MERCHANTS SHOWCASE */}
                    <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 13, textTransform: 'uppercase', marginBottom: 12, letterSpacing: 1.5 }}>Supported Merchants</Text>
                    
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            {SUPPORTED_MERCHANTS.map((m, i) => (
                                <View key={i} style={{ backgroundColor: '#ffffff', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#e2e8f0' }}>
                                    <Ionicons name={m.icon as any} size={18} color={m.color} />
                                    <Text style={{ color: '#0f172a', fontWeight: '800', fontSize: 12 }}>{m.name}</Text>
                                </View>
                            ))}
                        </View>
                    </ScrollView>

                    {/* Terminate Card Danger Zone */}
                    <TouchableOpacity
                        onPress={handleTerminateCard}
                        style={{ backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', padding: 16, borderRadius: 18, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                    >
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                        <Text style={{ color: '#ef4444', fontWeight: '900', fontSize: 13 }}>Terminate Card & Refund Balance</Text>
                    </TouchableOpacity>

                </ScrollView>
            ) : (
                /* ULTRA-MODERN FINTECH WELCOME LANDING SHOWCASE */
                <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 50 }} showsVerticalScrollIndicator={false}>
                    
                    {/* Welcome Header Badge */}
                    <View style={{ alignItems: 'center', marginBottom: 20 }}>
                        <View style={{ backgroundColor: '#fffbeb', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#fde68a', flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                            <Text style={{ fontSize: 12 }}>✨</Text>
                            <Text style={{ color: '#d97706', fontSize: 11, fontWeight: '900', letterSpacing: 1 }}>PAYVESSEL VIRTUAL CARDS</Text>
                        </View>
                        <Text style={{ color: '#0f172a', fontSize: 26, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5 }}>
                            Unlock Global Payments
                        </Text>
                        <Text style={{ color: '#64748b', fontSize: 13, textAlign: 'center', marginTop: 6, maxWidth: 320, lineHeight: 20 }}>
                            Issue instant Virtual Dollar & Naira cards for international subscriptions, online shopping, and ad bills.
                        </Text>
                    </View>

                    {/* INTERACTIVE 3D DEMO SHOWCASE CARD VISUAL */}
                    <LinearGradient
                        colors={['#0f172a', '#1e293b', '#0f172a']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{
                            width: '100%',
                            aspectRatio: 1.586,
                            borderRadius: 24,
                            padding: 24,
                            justifyContent: 'space-between',
                            marginBottom: 24,
                            borderWidth: 1.5,
                            borderColor: '#f5a623',
                            position: 'relative',
                            overflow: 'hidden',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 12 },
                            shadowOpacity: 0.25,
                            shadowRadius: 18,
                            elevation: 10
                        }}
                    >
                        <View style={{ position: 'absolute', top: -50, right: -50, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(245, 166, 35, 0.15)' }} />

                        {/* Card Header Row */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.25)' }}>
                                    <Text style={{ color: '#f5a623', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 }}>PAYVESSEL SECURE</Text>
                                </View>
                                <View style={{ backgroundColor: 'rgba(34, 197, 94, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: '#22c55e', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' }} />
                                    <Text style={{ color: '#4ade80', fontSize: 9, fontWeight: '900' }}>SAMPLE PREVIEW</Text>
                                </View>
                            </View>
                            <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 22, fontStyle: 'italic' }}>VISA</Text>
                        </View>

                        {/* Metallic Chip & Contactless */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, zIndex: 10 }}>
                            <View style={{ width: 44, height: 32, borderRadius: 7, backgroundColor: '#f5a623', borderWidth: 1.5, borderColor: '#fef08a', justifyContent: 'center', paddingHorizontal: 6 }}>
                                <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.3)', marginVertical: 3 }} />
                                <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.3)' }} />
                            </View>
                            <Ionicons name="wifi-outline" size={24} color="#ffffff" style={{ transform: [{ rotate: '90deg' }], opacity: 0.7 }} />
                        </View>

                        {/* Card Number */}
                        <View style={{ zIndex: 10 }}>
                            <Text style={{ color: '#ffffff', fontSize: 20, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', letterSpacing: 2.5, fontWeight: 'bold' }}>
                                5532 •••• •••• 8829
                            </Text>
                        </View>

                        {/* Card Footer */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', zIndex: 10 }}>
                            <View>
                                <Text style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 8, fontWeight: '800', textTransform: 'uppercase' }}>Card Holder</Text>
                                <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 14, marginTop: 2 }}>ABU MAFHAL USER</Text>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 16 }}>
                                <View>
                                    <Text style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 8, fontWeight: '800', textTransform: 'uppercase' }}>Expires</Text>
                                    <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 13, marginTop: 2 }}>12/28</Text>
                                </View>
                                <View>
                                    <Text style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 8, fontWeight: '800', textTransform: 'uppercase' }}>CVV</Text>
                                    <Text style={{ color: '#f5a623', fontWeight: '900', fontSize: 13, marginTop: 2 }}>•••</Text>
                                </View>
                            </View>
                        </View>
                    </LinearGradient>

                    {/* WHY GET A VIRTUAL CARD BENEFITS GRID */}
                    <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 13, textTransform: 'uppercase', marginBottom: 14, letterSpacing: 1.5 }}>Why Get A Virtual Card?</Text>
                    
                    <View style={{ gap: 12, marginBottom: 24 }}>
                        <View style={{ backgroundColor: '#ffffff', padding: 16, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 }}>
                            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center' }}>
                                <Ionicons name="globe-outline" size={22} color="#3b82f6" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 14 }}>Global Merchant Acceptance</Text>
                                <Text style={{ color: '#64748b', fontSize: 11, marginTop: 2, lineHeight: 16 }}>Pay seamlessly on Netflix, Amazon, Apple, ChatGPT AI, Spotify & 100k+ global stores.</Text>
                            </View>
                        </View>

                        <View style={{ backgroundColor: '#ffffff', padding: 16, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 }}>
                            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#ecfdf5', justifyContent: 'center', alignItems: 'center' }}>
                                <Ionicons name="flash-outline" size={22} color="#10b981" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 14 }}>Instant 5-Second Issuance</Text>
                                <Text style={{ color: '#64748b', fontSize: 11, marginTop: 2, lineHeight: 16 }}>No paper documentation or bank branch visits. Card activates instantly.</Text>
                            </View>
                        </View>

                        <View style={{ backgroundColor: '#ffffff', padding: 16, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 }}>
                            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#fffbeb', justifyContent: 'center', alignItems: 'center' }}>
                                <Ionicons name="shield-checkmark-outline" size={22} color="#d97706" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 14 }}>Bank-Grade Security Controls</Text>
                                <Text style={{ color: '#64748b', fontSize: 11, marginTop: 2, lineHeight: 16 }}>1-Tap Freeze, custom monthly spending limits, and US Billing Address included.</Text>
                            </View>
                        </View>
                    </View>

                    {/* SUPPORTED MERCHANTS BAR */}
                    <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 13, textTransform: 'uppercase', marginBottom: 12, letterSpacing: 1.5 }}>Supported Platforms</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            {SUPPORTED_MERCHANTS.map((m, i) => (
                                <View key={i} style={{ backgroundColor: '#ffffff', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#e2e8f0' }}>
                                    <Ionicons name={m.icon as any} size={18} color={m.color} />
                                    <Text style={{ color: '#0f172a', fontWeight: '800', fontSize: 12 }}>{m.name}</Text>
                                </View>
                            ))}
                        </View>
                    </ScrollView>

                    {/* CTA ISSUANCE BUTTON */}
                    <TouchableOpacity
                        onPress={() => {
                            setShowCreateModal(true);
                            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        }}
                        style={{ width: '100%', backgroundColor: '#0f172a', height: 56, borderRadius: 20, justifyContent: 'center', alignItems: 'center', shadowColor: '#0f172a', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6, flexDirection: 'row', gap: 8 }}
                    >
                        <Ionicons name="card" size={20} color="#ffffff" />
                        <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 16 }}>Issue Virtual Card ($3 Fee)</Text>
                    </TouchableOpacity>

                </ScrollView>
            )}

            {/* MODAL: LIMITS & CONTROLS */}
            <Modal visible={showControlsModal} animationType="slide" transparent presentationStyle="overFullScreen">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: '#ffffff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, borderWidth: 1, borderColor: '#e2e8f0' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text style={{ color: '#0f172a', fontSize: 20, fontWeight: '900' }}>Card Limits & Security Switches</Text>
                            <TouchableOpacity onPress={() => setShowControlsModal(false)}>
                                <Ionicons name="close-circle" size={26} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '800', marginBottom: 6, textTransform: 'uppercase' }}>Monthly Spending Limit ($ USD)</Text>
                        <TextInput
                            style={{ backgroundColor: '#f8fafc', color: '#0f172a', padding: 14, borderRadius: 16, fontSize: 16, fontWeight: 'bold', borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 20 }}
                            value={monthlySpendingLimit}
                            onChangeText={setMonthlySpendingLimit}
                            keyboardType="numeric"
                        />

                        <View style={{ gap: 12, marginBottom: 24 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0' }}>
                                <View>
                                    <Text style={{ fontWeight: 'bold', fontSize: 13, color: '#0f172a' }}>Online Shopping</Text>
                                    <Text style={{ fontSize: 10, color: '#64748b' }}>Allow web & app transactions</Text>
                                </View>
                                <Switch value={onlineShoppingEnabled} onValueChange={setOnlineShoppingEnabled} trackColor={{ false: '#cbd5e1', true: '#10b981' }} />
                            </View>

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0' }}>
                                <View>
                                    <Text style={{ fontWeight: 'bold', fontSize: 13, color: '#0f172a' }}>Contactless (Apple/Google Pay)</Text>
                                    <Text style={{ fontSize: 10, color: '#64748b' }}>NFC & Mobile wallet tap to pay</Text>
                                </View>
                                <Switch value={contactlessEnabled} onValueChange={setContactlessEnabled} trackColor={{ false: '#cbd5e1', true: '#10b981' }} />
                            </View>

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0' }}>
                                <View>
                                    <Text style={{ fontWeight: 'bold', fontSize: 13, color: '#0f172a' }}>Cross-Border Payments</Text>
                                    <Text style={{ fontSize: 10, color: '#64748b' }}>International merchant processing</Text>
                                </View>
                                <Switch value={internationalEnabled} onValueChange={setInternationalEnabled} trackColor={{ false: '#cbd5e1', true: '#10b981' }} />
                            </View>
                        </View>

                        <TouchableOpacity
                            onPress={() => {
                                setShowControlsModal(false);
                                Alert.alert('Security Settings Saved 🛡️', 'Your Virtual Card limits and security controls have been updated.');
                            }}
                            style={{ backgroundColor: '#0f172a', height: 50, borderRadius: 16, justifyContent: 'center', alignItems: 'center' }}
                        >
                            <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 15 }}>Save Controls 💾</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* MODAL: STATEMENT LOGS */}
            <Modal visible={showStatementModal} animationType="slide" transparent presentationStyle="overFullScreen">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: '#ffffff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, maxHeight: '80%', borderWidth: 1, borderColor: '#e2e8f0' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text style={{ color: '#0f172a', fontSize: 20, fontWeight: '900' }}>Card Statement Logs</Text>
                            <TouchableOpacity onPress={() => setShowStatementModal(false)}>
                                <Ionicons name="close-circle" size={26} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {[
                                { merchant: 'Netflix Subscription', date: 'Just Now', amount: '-$15.99', status: 'SETTLED', icon: 'logo-netflix', color: '#E50914' },
                                { merchant: 'Amazon Web Services', date: 'Yesterday', amount: '-$45.00', status: 'SETTLED', icon: 'logo-amazon', color: '#FF9900' },
                                { merchant: 'ChatGPT Plus Subscription', date: '2 days ago', amount: '-$20.00', status: 'SETTLED', icon: 'sparkles', color: '#10A37F' },
                                { merchant: 'Card Wallet Funding', date: '3 days ago', amount: '+$100.00', status: 'CREDIT', icon: 'add-circle', color: '#10b981' },
                            ].map((tx, i) => (
                                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: 14, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: '#ffffff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' }}>
                                            <Ionicons name={tx.icon as any} size={18} color={tx.color} />
                                        </View>
                                        <View>
                                            <Text style={{ fontWeight: 'bold', fontSize: 13, color: '#0f172a' }}>{tx.merchant}</Text>
                                            <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{tx.date}</Text>
                                        </View>
                                    </View>

                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={{ fontWeight: '900', fontSize: 14, color: tx.amount.startsWith('+') ? '#10b981' : '#0f172a' }}>{tx.amount}</Text>
                                        <Text style={{ fontSize: 9, fontWeight: '800', color: '#10b981', marginTop: 2 }}>{tx.status}</Text>
                                    </View>
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* MODAL 1: CREATE VIRTUAL CARD */}
            <Modal visible={showCreateModal} animationType="slide" transparent presentationStyle="overFullScreen">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: '#ffffff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, borderWidth: 1, borderColor: '#e2e8f0' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text style={{ color: '#0f172a', fontSize: 20, fontWeight: '900' }}>Issue Virtual Card</Text>
                            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                                <Ionicons name="close-circle" size={26} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>

                        {/* Currency Selection */}
                        <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Select Card Currency</Text>
                        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                            <TouchableOpacity
                                onPress={() => setCardCurrency('USD')}
                                style={{ flex: 1, padding: 14, borderRadius: 16, backgroundColor: cardCurrency === 'USD' ? '#0f172a' : '#f8fafc', alignItems: 'center', borderWidth: 1, borderColor: cardCurrency === 'USD' ? '#0f172a' : '#e2e8f0' }}
                            >
                                <Text style={{ color: cardCurrency === 'USD' ? '#ffffff' : '#0f172a', fontWeight: '900', fontSize: 14 }}>🇺🇸 USD Dollar Card</Text>
                                <Text style={{ color: cardCurrency === 'USD' ? '#94a3b8' : '#64748b', fontSize: 9, marginTop: 2, fontWeight: '700' }}>For International Bills</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setCardCurrency('NGN')}
                                style={{ flex: 1, padding: 14, borderRadius: 16, backgroundColor: cardCurrency === 'NGN' ? '#0f172a' : '#f8fafc', alignItems: 'center', borderWidth: 1, borderColor: cardCurrency === 'NGN' ? '#0f172a' : '#e2e8f0' }}
                            >
                                <Text style={{ color: cardCurrency === 'NGN' ? '#ffffff' : '#0f172a', fontWeight: '900', fontSize: 14 }}>🇳🇬 NGN Naira Card</Text>
                                <Text style={{ color: cardCurrency === 'NGN' ? '#94a3b8' : '#64748b', fontSize: 9, marginTop: 2, fontWeight: '700' }}>For Local Merchant Bills</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Initial Funding Chips */}
                        <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Initial Funding Amount ({cardCurrency})</Text>
                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                            {['10', '25', '50', '100'].map(val => (
                                <TouchableOpacity
                                    key={val}
                                    onPress={() => setInitialFundAmount(val)}
                                    style={{
                                        flex: 1,
                                        paddingVertical: 10,
                                        borderRadius: 12,
                                        backgroundColor: initialFundAmount === val ? '#fffbeb' : '#f8fafc',
                                        borderWidth: 1,
                                        borderColor: initialFundAmount === val ? '#d97706' : '#e2e8f0',
                                        alignItems: 'center'
                                    }}
                                >
                                    <Text style={{ color: initialFundAmount === val ? '#d97706' : '#0f172a', fontWeight: '900', fontSize: 12 }}>
                                        {cardCurrency === 'USD' ? '$' : '₦'}{val}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TextInput
                            style={{ backgroundColor: '#f8fafc', color: '#0f172a', padding: 14, borderRadius: 16, fontSize: 16, fontWeight: 'bold', borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 }}
                            placeholder="Or enter custom amount"
                            placeholderTextColor="#94a3b8"
                            keyboardType="numeric"
                            value={initialFundAmount}
                            onChangeText={setInitialFundAmount}
                        />

                        {/* ACCURATE TRANSPARENT FEE BREAKDOWN */}
                        <View style={{ backgroundColor: '#f8fafc', padding: 14, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                                <Text style={{ color: '#64748b', fontSize: 11 }}>Card Creation Fee ($3.00 USD)</Text>
                                <Text style={{ color: '#0f172a', fontSize: 11, fontWeight: 'bold' }}>₦{creationCharges.creationFeeNGN.toLocaleString()}</Text>
                            </View>

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                                <Text style={{ color: '#64748b', fontSize: 11 }}>
                                    Initial Card Funding ({cardCurrency === 'USD' ? `$${initialFundAmount || 0}` : `₦${initialFundAmount || 0}`})
                                </Text>
                                <Text style={{ color: '#0f172a', fontSize: 11, fontWeight: 'bold' }}>
                                    ₦{creationCharges.fundChargeNGN.toLocaleString()}
                                </Text>
                            </View>

                            <View style={{ height: 1, backgroundColor: '#e2e8f0', marginVertical: 6 }} />
                            
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={{ color: '#d97706', fontSize: 13, fontWeight: '900' }}>Total Wallet Charge</Text>
                                <Text style={{ color: '#d97706', fontSize: 15, fontWeight: '900' }}>
                                    ₦{creationCharges.totalNGN.toLocaleString()}
                                </Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            onPress={handleCreateCard}
                            disabled={actionLoading}
                            style={{ backgroundColor: '#0f172a', height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowColor: '#0f172a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 }}
                        >
                            {actionLoading ? <ActivityIndicator color="#ffffff" /> : <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 16 }}>Issue Card Instantly 💳</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* MODAL 2: FUND CARD */}
            <Modal visible={showFundModal} animationType="slide" transparent presentationStyle="overFullScreen">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: '#ffffff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, borderWidth: 1, borderColor: '#e2e8f0' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text style={{ color: '#0f172a', fontSize: 20, fontWeight: '900' }}>+ Fund Virtual Card</Text>
                            <TouchableOpacity onPress={() => setShowFundModal(false)}>
                                <Ionicons name="close-circle" size={26} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ color: '#64748b', fontSize: 12, marginBottom: 12 }}>Enter funding amount in {selectedCard?.currency}:</Text>
                        
                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                            {['10', '25', '50', '100'].map(val => (
                                <TouchableOpacity
                                    key={val}
                                    onPress={() => setFundAmountInput(val)}
                                    style={{
                                        flex: 1,
                                        paddingVertical: 10,
                                        borderRadius: 12,
                                        backgroundColor: fundAmountInput === val ? '#ecfdf5' : '#f8fafc',
                                        borderWidth: 1,
                                        borderColor: fundAmountInput === val ? '#10b981' : '#e2e8f0',
                                        alignItems: 'center'
                                    }}
                                >
                                    <Text style={{ color: fundAmountInput === val ? '#10b981' : '#0f172a', fontWeight: '900', fontSize: 12 }}>
                                        {selectedCard?.currency === 'USD' ? '$' : '₦'}{val}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TextInput
                            style={{ backgroundColor: '#f8fafc', color: '#0f172a', padding: 14, borderRadius: 16, fontSize: 18, fontWeight: 'bold', borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 }}
                            placeholder={`Amount (${selectedCard?.currency})`}
                            placeholderTextColor="#94a3b8"
                            keyboardType="numeric"
                            value={fundAmountInput}
                            onChangeText={setFundAmountInput}
                        />

                        {selectedCard && (
                            <Text style={{ color: '#d97706', fontSize: 12, fontWeight: '900', marginBottom: 20 }}>
                                Total Wallet Deduction: ₦{((Number(fundAmountInput) || 0) * (selectedCard.currency === 'USD' ? usdRate : 1)).toLocaleString()}
                            </Text>
                        )}

                        <TouchableOpacity
                            onPress={handleFundCard}
                            disabled={actionLoading}
                            style={{ backgroundColor: '#10b981', height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowColor: '#10b981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 }}
                        >
                            {actionLoading ? <ActivityIndicator color="#ffffff" /> : <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 16 }}>Confirm Funding 💳</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* MODAL 3: WITHDRAW FROM CARD */}
            <Modal visible={showWithdrawModal} animationType="slide" transparent presentationStyle="overFullScreen">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: '#ffffff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, borderWidth: 1, borderColor: '#e2e8f0' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text style={{ color: '#0f172a', fontSize: 20, fontWeight: '900' }}>💸 Withdraw to Wallet</Text>
                            <TouchableOpacity onPress={() => setShowWithdrawModal(false)}>
                                <Ionicons name="close-circle" size={26} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ color: '#64748b', fontSize: 12, marginBottom: 12 }}>Available Card Balance: {selectedCard?.currency === 'USD' ? '$' : '₦'}{selectedCard?.balance}</Text>
                        <TextInput
                            style={{ backgroundColor: '#f8fafc', color: '#0f172a', padding: 14, borderRadius: 16, fontSize: 18, fontWeight: 'bold', borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 }}
                            placeholder={`Amount (${selectedCard?.currency})`}
                            placeholderTextColor="#94a3b8"
                            keyboardType="numeric"
                            value={withdrawAmountInput}
                            onChangeText={setWithdrawAmountInput}
                        />

                        <TouchableOpacity
                            onPress={handleWithdrawFromCard}
                            disabled={actionLoading}
                            style={{ backgroundColor: '#3b82f6', height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 }}
                        >
                            {actionLoading ? <ActivityIndicator color="#ffffff" /> : <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 16 }}>Withdraw to Main Wallet 💸</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* MODAL 4: BILLING ADDRESS */}
            <Modal visible={showAddressModal} animationType="slide" transparent presentationStyle="overFullScreen">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: '#ffffff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, borderWidth: 1, borderColor: '#e2e8f0' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text style={{ color: '#0f172a', fontSize: 20, fontWeight: '900' }}>📍 US Billing Address</Text>
                            <TouchableOpacity onPress={() => setShowAddressModal(false)}>
                                <Ionicons name="close-circle" size={26} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ color: '#64748b', fontSize: 12, marginBottom: 16 }}>Use these exact details when checking out on US/International merchant platforms:</Text>

                        <View style={{ backgroundColor: '#f8fafc', padding: 16, borderRadius: 18, gap: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 20 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ color: '#64748b', fontSize: 12 }}>Street</Text>
                                <Text style={{ color: '#0f172a', fontSize: 13, fontWeight: 'bold' }}>{selectedCard?.billing_address?.street || '350 Fifth Avenue'}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ color: '#64748b', fontSize: 12 }}>City</Text>
                                <Text style={{ color: '#0f172a', fontSize: 13, fontWeight: 'bold' }}>{selectedCard?.billing_address?.city || 'New York'}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ color: '#64748b', fontSize: 12 }}>State</Text>
                                <Text style={{ color: '#0f172a', fontSize: 13, fontWeight: 'bold' }}>{selectedCard?.billing_address?.state || 'NY'}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ color: '#64748b', fontSize: 12 }}>Zip Code</Text>
                                <Text style={{ color: '#0f172a', fontSize: 13, fontWeight: 'bold' }}>{selectedCard?.billing_address?.zip || '10118'}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ color: '#64748b', fontSize: 12 }}>Country</Text>
                                <Text style={{ color: '#0f172a', fontSize: 13, fontWeight: 'bold' }}>United States (US)</Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            onPress={() => setShowAddressModal(false)}
                            style={{ backgroundColor: '#0f172a', height: 50, borderRadius: 16, justifyContent: 'center', alignItems: 'center' }}
                        >
                            <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 15 }}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

        </View>
    );
}
