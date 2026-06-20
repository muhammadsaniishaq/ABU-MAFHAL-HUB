import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform, LayoutAnimation, Modal, FlatList, StyleSheet } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../services/api';
import { supabase } from '../services/supabase';
import { DataPlan } from '../services/partners';
import SecurityModal from '../components/SecurityModal';
import TransactionConfirmationModal from '../components/TransactionConfirmationModal';

// Network Logos
const NETWORK_LOGOS: Record<string, any> = {
    mtn: require('../assets/images/mtn.png'),
    glo: require('../assets/images/glo.png'),
    airtel: require('../assets/images/airtel.png'),
    '9mobile': require('../assets/images/9mobile.png'),
};

const NETWORKS_DATA = [
    { id: 'mtn', name: 'MTN', color: '#FFCC00', prefixes: ['0803', '0806', '0703', '0903', '0810', '0813', '0814', '0816', '0906', '0706', '0913', '0916'] },
    { id: 'glo', name: 'Glo', color: '#0F6A37', prefixes: ['0805', '0807', '0705', '0815', '0811', '0905', '0915'] },
    { id: 'airtel', name: 'Airtel', color: '#FF0000', prefixes: ['0802', '0808', '0708', '0812', '0701', '0902', '0904', '0907', '0901', '0912'] },
    { id: '9mobile', name: '9mobile', color: '#006B3E', prefixes: ['0809', '0818', '0817', '0909', '0908'] },
];

const T = {
  navy:    '#0d1b3e',
  navyMid: '#142258',
  gold:    '#f5a623',
  goldDk:  '#d4890e',
  white:   '#ffffff',
  bg:      '#f4f6fb',
  text:    '#0d1b3e',
  textSub: '#5a6890',
  indigo:  '#4F46E5',
};

export default function DataScreen() {
    const [network, setNetwork] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [selectedPlan, setSelectedPlan] = useState<DataPlan | null>(null);
    const [plans, setPlans] = useState<DataPlan[]>([]);
    const [loadingPlans, setLoadingPlans] = useState(false);
    const [loadingPurchase, setLoadingPurchase] = useState(false);
    
    // UI states
    const [balance, setBalance] = useState<number | null>(null);
    const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
    const [showBeneficiaryModal, setShowBeneficiaryModal] = useState(false);
    const [showSecurityModal, setShowSecurityModal] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [planFilter, setPlanFilter] = useState<'All' | 'Favorites' | 'Daily' | 'Weekly' | 'Monthly'>('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [lastTransaction, setLastTransaction] = useState<any>(null);
    const [favorites, setFavorites] = useState<string[]>([]);
    
    const router = useRouter();
    const isWeb = Platform.OS === 'web';

    // Initial Data Load
    useEffect(() => {
        fetchUserData();
        fetchBeneficiaries();
        fetchLastTransaction();
    }, []);

    const fetchLastTransaction = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        const { data } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', user.id)
            .eq('type', 'data')
            .eq('status', 'success')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
            
        if (data) setLastTransaction(data);
    };

    const fetchUserData = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase.from('profiles').select('balance').eq('id', user.id).single();
            if (data) setBalance(data.balance);
        }
    };

    const fetchBeneficiaries = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase.from('beneficiaries').select('*').eq('user_id', user.id);
            if (data) setBeneficiaries(data);
        }
    };

    // Auto-detect Network
    const detectNetwork = useCallback((phone: string) => {
        const cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length >= 4) {
            const prefix = cleanPhone.substring(0, 4);
            const found = NETWORKS_DATA.find(n => n.prefixes.includes(prefix));
            if (found && found.id !== network) {
                 setNetwork(found.id);
            }
        }
    }, [network]);

    const handlePhoneChange = (text: string) => {
        setPhoneNumber(text);
        detectNetwork(text);
    };

    // Fetch plans when network changes
    useEffect(() => {
        if (network) {
            fetchPlans(network);
            setSelectedPlan(null); // Reset selection
        } else {
            setPlans([]);
        }
    }, [network]);

    // Derived State: Filtered Plans
    const filteredPlans = plans.filter(p => {
        // Search Filter
        if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) {
            return false;
        }

        // Duration Filter
        if (planFilter === 'All') return true;
        if (planFilter === 'Favorites') return favorites.includes(p.id);
        
        const rawVal = (p.validity || '').toLowerCase();
        const nameVal = (p.originalName || p.name).toLowerCase();
        let days = parseInt(p.validity) || 0;

        const combinedText = rawVal + ' ' + nameVal;
        const durationMatch = combinedText.match(/(\d+)\s*(day|week|month|hr|hour)/i);
        
        if (durationMatch) {
            const num = parseInt(durationMatch[1]);
            const unit = durationMatch[2].toLowerCase();
            
            if (unit.startsWith('hr') || unit.startsWith('hour')) days = 1;
            else if (unit.startsWith('day')) days = num;
            else if (unit.startsWith('week')) days = num * 7;
            else if (unit.startsWith('month')) days = num * 30;
        }

        if (days === 0 || days === 30) {
            if (combinedText.includes('daily') || combinedText.includes('24hr')) days = 1;
            else if (combinedText.includes('weekly')) days = 7;
            else if (combinedText.includes('monthly') || combinedText.includes('30 days')) days = 30;
        }

        if (planFilter === 'Daily') {
             return (days > 0 && days < 7);
        }
        if (planFilter === 'Weekly') {
             return (days >= 7 && days < 28);
        }
        if (planFilter === 'Monthly') {
             return (days >= 28);
        }
        return true;
    });

    const handleQuickRepeat = () => {
        if (!lastTransaction) return;
        
        const desc = lastTransaction.description || '';
        const parts = desc.split(' -> ');
        if (parts.length === 2) {
             const phone = parts[1];
             setPhoneNumber(phone);
             detectNetwork(phone);
             Alert.alert("Quick Load", `Phone number ${phone} loaded. Please select your plan.`);
        }
    };

    const toggleFavorite = (planId: string) => {
        setFavorites(prev => prev.includes(planId) ? prev.filter(id => id !== planId) : [...prev, planId]);
    };

    const fetchPlans = async (netId: string) => {
        setLoadingPlans(true);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        try {
            const { data, error } = await supabase
                .from('data_plans')
                .select('*')
                .eq('network', netId.toLowerCase())
                .eq('is_active', true)
                .order('cost_price', { ascending: true });

            if (error) throw error;

            const mappedPlans: DataPlan[] = (data || []).map((p: any) => {
                let inferredValidity = p.validity;
                if (!inferredValidity) {
                    const nameLower = p.name.toLowerCase();
                    if (nameLower.includes('daily') || nameLower.includes('24hr')) inferredValidity = '1 Day';
                    else if (nameLower.includes('weekly') || nameLower.includes('7 days')) inferredValidity = '7 Days';
                    else if (nameLower.includes('monthly') || nameLower.includes('30 days')) inferredValidity = '30 Days';
                    else {
                         const match = p.name.match(/(\d+)\s*(day|week|month|hr)/i);
                         if (match) inferredValidity = match[0];
                         else inferredValidity = '30 Days';
                    }
                }

                return {
                    id: p.plan_id,
                    code: p.plan_id,
                    name: p.name.replace(/\b(Daily|Weekly|Monthly|Day|Week|Month|Days|Weeks|Months|Hour|Hours|Hr|Hrs)\b/gi, '').replace(/\d+(hr|hrs)/gi, '').trim(),
                    originalName: p.name,
                    price: p.selling_price,
                    validity: inferredValidity,
                    volume: p.volume,
                    network: p.network,
                    icon: p.icon_url
                };
            });

            setPlans(mappedPlans);
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to load data plans");
        } finally {
            setLoadingPlans(false);
        }
    };

    const handlePurchase = () => {
        if (!network || !phoneNumber || !selectedPlan) {
            Alert.alert("Error", "Please fill all fields");
            return;
        }

        if (phoneNumber.length < 11) {
             Alert.alert("Invalid Phone", "Please enter a valid 11-digit phone number");
             return;
        }

        setShowConfirmation(true);
    };

    const processTransaction = async () => {
        if (!selectedPlan) return;
        setLoadingPurchase(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not authenticated");

            const result = await api.data.purchase(user.id, {
                network,
                phone: phoneNumber,
                planId: selectedPlan.id,
                amount: selectedPlan.price,
                planName: selectedPlan.name
            });

            if (result.success) {
                router.replace({
                    pathname: '/success',
                    params: {
                        amount: `₦${selectedPlan.price}`,
                        type: 'Data Bundle',
                        reference: result.reference
                    }
                });
            }
        } catch (error: any) {
            console.error(error);
            Alert.alert("Error", error.message || "Something went wrong");
        } finally {
            setLoadingPurchase(false);
        }
    };

    const getNetworkColor = (netId: string) => {
        return NETWORKS_DATA.find(n => n.id === netId)?.color || '#0056D2';
    };

    return (
        <View style={s.pageWrapper}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            <KeyboardAvoidingView 
                behavior={Platform.OS === "ios" ? "padding" : "height"} 
                style={{ flex: 1 }}
            >
                {/* Premium Curved Header */}
                <LinearGradient 
                    colors={['#060d21', '#0d1b3e']} 
                    style={[s.headerContainer, isWeb && s.webPageContainer]}
                >
                    <View style={s.headerTop}>
                        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
                            <Ionicons name="arrow-back" size={20} color="white" />
                        </TouchableOpacity>
                        <View style={{ alignItems: 'center' }}>
                            <Text style={s.headerTitle}>Internet Data</Text>
                            {balance !== null && (
                                <Text style={s.headerBalance}>
                                    Balance: ₦{balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </Text>
                            )}
                        </View>
                        <View style={{ width: 32 }} />
                    </View>
                </LinearGradient>

                <ScrollView 
                    style={{ flex: 1 }}
                    contentContainerStyle={[s.scrollContainer, isWeb && s.webPageContainer]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Quick Repeat Card */}
                    {lastTransaction && (
                        <TouchableOpacity 
                            onPress={handleQuickRepeat}
                            style={s.quickRepeatCard}
                            activeOpacity={0.8}
                        >
                            <View style={s.quickRepeatLeft}>
                                <View style={s.quickRepeatIconCircle}>
                                    <Ionicons name="refresh" size={18} color="#F97316" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.quickRepeatTitle}>Repeat Last Purchase</Text>
                                    <Text style={s.quickRepeatDesc} numberOfLines={1} ellipsizeMode="tail">
                                        {lastTransaction.description ? lastTransaction.description.split('->')[0].trim() : 'Data Bundle'}
                                    </Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
                        </TouchableOpacity>
                    )}

                    {/* Network Selection */}
                    <Text style={s.sectionTitle}>Select Network</Text>
                    <View style={s.networksRow}>
                        {NETWORKS_DATA.map((net) => {
                            const isSelected = network === net.id;
                            const netColor = getNetworkColor(net.id);
                            return (
                                <TouchableOpacity
                                    key={net.id}
                                    onPress={() => setNetwork(net.id)}
                                    style={[
                                        s.networkCard,
                                        isSelected && [s.networkCardSelected, { borderColor: netColor, shadowColor: netColor }]
                                    ]}
                                    activeOpacity={0.8}
                                >
                                    <Image 
                                        source={NETWORK_LOGOS[net.id]} 
                                        style={s.networkLogo}
                                        resizeMode="contain" 
                                    />
                                    <Text style={[s.networkName, isSelected && s.networkNameSelected]}>
                                        {net.name}
                                    </Text>
                                    {isSelected && (
                                        <View style={[s.checkBadge, { backgroundColor: netColor }]}>
                                            <Ionicons name="checkmark" size={10} color="white" />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Phone Number Input */}
                    <Text style={s.sectionTitle}>Phone Number</Text>
                    <View style={[s.inputBoxContainer, phoneNumber.length > 0 && s.inputBoxFocused]}>
                        <View style={s.inputBoxLogoWrapper}>
                            {network ? (
                                <Image source={NETWORK_LOGOS[network]} style={s.inputBoxLogo} resizeMode="cover" />
                            ) : (
                                <Ionicons name="call-outline" size={18} color="#94a3b8" />
                            )}
                        </View>
                        <TextInput
                            style={s.textInput}
                            keyboardType="phone-pad"
                            placeholder="Enter 11-digit phone number"
                            placeholderTextColor="#94a3b8"
                            value={phoneNumber}
                            onChangeText={handlePhoneChange}
                            maxLength={11}
                        />
                        <TouchableOpacity 
                            onPress={() => setShowBeneficiaryModal(true)}
                            style={s.beneficiaryBtn}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="people" size={18} color="#0056D2" />
                        </TouchableOpacity>

                        {phoneNumber.length > 0 && (
                            <TouchableOpacity onPress={() => handlePhoneChange('')} style={s.clearBtn}>
                                <Ionicons name="close-circle" size={18} color="#D1D5DB" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Data Plans Grid */}
                    {loadingPlans ? (
                        <View style={{ height: 160, alignItems: 'center', justifyContent: 'center' }}>
                            <ActivityIndicator size="large" color="#0d1b3e" />
                            <Text style={{ color: '#94a3b8', marginTop: 8, fontSize: 13 }}>Loading plans...</Text>
                        </View>
                    ) : (
                        <View>
                            {plans.length > 0 && (
                                <View style={{ marginBottom: 20 }}>
                                    {/* Search Bar */}
                                    <View style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        backgroundColor: '#ffffff',
                                        borderRadius: 14,
                                        paddingHorizontal: 12,
                                        height: 44,
                                        marginBottom: 16,
                                        borderWidth: 1.5,
                                        borderColor: '#e2e8f0',
                                    }}>
                                        <Ionicons name="search-outline" size={18} color="#94a3b8" />
                                        <TextInput 
                                            style={{ flex: 1, marginLeft: 8, fontSize: 14, color: '#0d1b3e', fontWeight: '500' }}
                                            placeholder="Search plans (e.g. 1GB, Weekend)..."
                                            placeholderTextColor="#94a3b8"
                                            value={searchQuery}
                                            onChangeText={text => {
                                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                                setSearchQuery(text);
                                            }}
                                        />
                                        {searchQuery.length > 0 && (
                                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                                <Ionicons name="close-circle" size={16} color="#D1D5DB" />
                                            </TouchableOpacity>
                                        )}
                                    </View>

                                    <Text style={s.sectionTitle}>Filter Plans</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 8 }}>
                                        {['All', 'Favorites', 'Daily', 'Weekly', 'Monthly'].map((f) => {
                                            const isActive = planFilter === f;
                                            return (
                                                <TouchableOpacity
                                                    key={f}
                                                    onPress={() => setPlanFilter(f as any)}
                                                    style={[s.filterPill, isActive && s.filterPillActive]}
                                                    activeOpacity={0.8}
                                                >
                                                    <Text style={[s.filterPillText, isActive && s.filterPillTextActive]}>
                                                        {f}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </ScrollView>
                                </View>
                            )}
                            
                            {plans.length > 0 && <Text style={s.sectionTitle}>Available Plans</Text>}
                            
                            {!network ? (
                                 <View style={{
                                     height: 120,
                                     alignItems: 'center',
                                     justifyContent: 'center',
                                     backgroundColor: '#eff6ff',
                                     borderRadius: 20,
                                     borderStyle: 'dashed',
                                     borderWidth: 1.5,
                                     borderColor: '#bfdbfe',
                                     paddingHorizontal: 20,
                                 }}>
                                     <Ionicons name="cellular-outline" size={28} color="#3b82f6" />
                                     <Text style={{ color: '#3b82f6', marginTop: 8, fontWeight: '700', fontSize: 13 }}>
                                         Select a network to see plans
                                     </Text>
                                 </View>
                            ) : (
                                <View style={s.plansContainer}>
                                    {filteredPlans.map((plan) => {
                                        const isSelected = selectedPlan?.id === plan.id;
                                        const isFav = favorites.includes(plan.id);
                                        const isBestValue = (plan.validity.toLowerCase().includes('30') && plan.price < 1000);
                                        const isMega = plan.name.toLowerCase().includes('mega');
                                        
                                        return (
                                        <View key={plan.id} style={s.planCardWrapper}>
                                            <TouchableOpacity
                                                onPress={() => setSelectedPlan(plan)}
                                                style={[s.planCard, isSelected && s.planCardSelected]}
                                                activeOpacity={0.7}
                                            >
                                                <LinearGradient
                                                    colors={isSelected ? ['#102258', '#0b163a'] : ['#ffffff', '#ffffff']}
                                                    style={s.planCardGradient}
                                                >
                                                    {isBestValue && (
                                                        <View style={s.bestValueBadge}>
                                                            <Text style={s.bestValueText}>BEST VALUE</Text>
                                                        </View>
                                                    )}
                                                    {isMega && (
                                                        <View style={[s.bestValueBadge, { backgroundColor: '#8b5cf6' }]}>
                                                            <Text style={s.bestValueText}>MEGA</Text>
                                                        </View>
                                                    )}

                                                    <View style={s.planValidityContainer}>
                                                        <View style={[s.validityBadge, isSelected && s.validityBadgeSelected]}>
                                                            <Text style={[s.validityText, isSelected && s.validityTextSelected]}>
                                                                {plan.validity}
                                                            </Text>
                                                        </View>
                                                        
                                                        <TouchableOpacity onPress={() => toggleFavorite(plan.id)} style={{ padding: 4 }}>
                                                            <Ionicons 
                                                                name={isFav ? "heart" : "heart-outline"} 
                                                                size={18} 
                                                                color={isFav ? (isSelected ? "#f87171" : "#ef4444") : (isSelected ? "rgba(255,255,255,0.4)" : "#94a3b8")} 
                                                            />
                                                        </TouchableOpacity>
                                                    </View>
                                                    
                                                    <Text style={[s.planName, isSelected && s.planNameSelected]} numberOfLines={2}>
                                                        {plan.name}
                                                    </Text>
                                                    <Text style={[s.planPrice, isSelected && s.planPriceSelected]}>
                                                        ₦{plan.price.toLocaleString()}
                                                    </Text>
                                                </LinearGradient>
                                            </TouchableOpacity>
                                        </View>
                                    )})}
                                    
                                    {plans.length > 0 && filteredPlans.length === 0 && (
                                         <View style={{ width: '100%', alignItems: 'center', justifyContent: 'center', paddingVertical: 24 }}>
                                            <Text style={{ color: '#94a3b8', fontSize: 13 }}>No matching plans found.</Text>
                                         </View>
                                    )}
                                    
                                    {plans.length === 0 && (
                                         <View style={{ width: '100%', alignItems: 'center', justifyContent: 'center', paddingVertical: 24 }}>
                                            <Text style={{ color: '#94a3b8', fontSize: 13 }}>No active plans found for this network.</Text>
                                         </View>
                                    )}
                                </View>
                            )}
                        </View>
                    )}
                </ScrollView>

                {/* Bottom Floating Button */}
                <View style={[s.bottomButtonWrapper, isWeb && s.webPageContainer]}>
                    <TouchableOpacity
                        style={[
                            s.purchaseBtn,
                            !(network && phoneNumber.length === 11 && selectedPlan && !loadingPurchase) && { backgroundColor: '#cbd5e1', shadowOpacity: 0 }
                        ]}
                        onPress={handlePurchase}
                        disabled={!network || phoneNumber.length !== 11 || !selectedPlan || loadingPurchase}
                    >
                        {loadingPurchase ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <LinearGradient
                                colors={network && phoneNumber.length === 11 && selectedPlan ? ['#eab308', '#d97706'] : ['#cbd5e1', '#cbd5e1']}
                                style={s.purchaseBtnGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                <Text style={s.purchaseBtnText}>
                                    {selectedPlan ? `Pay ₦${selectedPlan.price.toLocaleString()}` : 'Purchase Bundle'}
                                </Text>
                                <Ionicons name="arrow-forward" size={16} color="white" style={{ marginLeft: 6 }} />
                            </LinearGradient>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            <BeneficiaryModal />

            <TransactionConfirmationModal
                visible={showConfirmation}
                onClose={() => setShowConfirmation(false)}
                onConfirm={() => {
                    setShowConfirmation(false);
                    setTimeout(() => setShowSecurityModal(true), 500);
                }}
                title="Confirm Data Purchase"
                network={network}
                details={[
                    { label: 'Transaction Type', value: 'Data Bundle' },
                    { label: 'Network', value: NETWORKS_DATA.find(n => n.id === network)?.name || network },
                    { label: 'Phone Number', value: phoneNumber },
                    { label: 'Data Plan', value: selectedPlan?.name || '-' },
                    { label: 'Validity', value: selectedPlan?.validity || '-' },
                    { label: 'Original Price', value: `₦${selectedPlan?.price?.toLocaleString() || '0'}`, isAmount: true },
                    { label: 'Total To Pay', value: `₦${selectedPlan?.price?.toLocaleString() || '0'}`, isTotal: true },
                ]}
            />

            <SecurityModal 
                visible={showSecurityModal}
                onClose={() => setShowSecurityModal(false)}
                onSuccess={() => {
                    setShowSecurityModal(false);
                    setTimeout(() => processTransaction(), 500);
                }}
                title="Authorize Purchase"
                description={selectedPlan ? `Confirm purchase of ${selectedPlan.name} for ${phoneNumber} @ ₦${selectedPlan.price}` : "Enter PIN"}
                requiredFor="purchase"
            />
        </View>
    );

    function BeneficiaryModal() {
        return (
            <Modal
                animationType="slide"
                transparent={true}
                visible={showBeneficiaryModal}
                onRequestClose={() => setShowBeneficiaryModal(false)}
            >
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <View 
                        className="bg-white rounded-t-3xl h-[60%] p-5"
                        style={isWeb && { alignSelf: 'center', width: '100%', maxWidth: 450, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
                    >
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-xl font-bold text-gray-800">Select Beneficiary</Text>
                            <TouchableOpacity onPress={() => setShowBeneficiaryModal(false)}>
                                <Ionicons name="close-circle" size={28} color="#9CA3AF" />
                            </TouchableOpacity>
                        </View>
                        
                        <FlatList
                            data={beneficiaries}
                            keyExtractor={item => item.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    className="flex-row items-center p-4 border-b border-gray-100"
                                    onPress={() => {
                                        handlePhoneChange(item.account_number);
                                        setShowBeneficiaryModal(false);
                                    }}
                                >
                                    <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3">
                                        <Text className="text-blue-600 font-bold">{item.name[0]}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text className="font-bold text-gray-800" numberOfLines={1}>{item.name}</Text>
                                        <Text className="text-gray-500 text-xs" numberOfLines={1}>{item.bank_name} - {item.account_number}</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={
                                <View className="items-center py-10">
                                    <Text className="text-gray-400">No beneficiaries found</Text>
                                </View>
                            }
                        />
                    </View>
                </View>
            </Modal>
        );
    }
}

const s = StyleSheet.create({
  pageWrapper: {
    flex: 1,
    backgroundColor: '#f4f6fb',
  },
  webPageContainer: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 450,
  },
  headerContainer: {
    paddingTop: Platform.OS === 'ios' ? 54 : 40,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingHorizontal: 20,
    width: '100%',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headerBalance: {
    color: '#f5a623',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  scrollContainer: {
    paddingBottom: 40,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0d1b3e',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  networksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    width: '100%',
  },
  networkCard: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '22%',
    aspectRatio: 0.95,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    shadowColor: '#0a1633',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    position: 'relative',
  },
  networkCardSelected: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  networkLogo: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  networkName: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 6,
    color: '#64748b',
  },
  networkNameSelected: {
    color: '#0d1b3e',
    fontWeight: '800',
  },
  checkBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    borderRadius: 8,
    padding: 1,
  },
  inputBoxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    shadowColor: '#0a1633',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    width: '100%',
  },
  inputBoxFocused: {
    borderColor: '#0d1b3e',
  },
  inputBoxLogoWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#edf2f7',
  },
  inputBoxLogo: {
    width: '100%',
    height: '100%',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#0d1b3e',
  },
  beneficiaryBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  clearBtn: {
    padding: 4,
  },
  filterPill: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  filterPillActive: {
    backgroundColor: '#0d1b3e',
    borderColor: '#0d1b3e',
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  filterPillTextActive: {
    color: '#ffffff',
  },
  plansContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 16,
  },
  planCardWrapper: {
    width: '48.5%',
    marginBottom: 12,
  },
  planCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    shadowColor: '#0a1633',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    overflow: 'hidden',
  },
  planCardSelected: {
    borderColor: '#0d1b3e',
    borderWidth: 2,
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 5,
  },
  planCardGradient: {
    padding: 14,
    minHeight: 110,
    justifyContent: 'space-between',
  },
  planValidityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 8,
  },
  validityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  validityBadgeSelected: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  validityText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#475569',
  },
  validityTextSelected: {
    color: '#ffffff',
  },
  planName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0d1b3e',
    lineHeight: 18,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  planNameSelected: {
    color: '#ffffff',
  },
  planPrice: {
    fontSize: 16,
    fontWeight: '900',
    color: '#2563eb',
  },
  planPriceSelected: {
    color: '#f5a623',
  },
  bestValueBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#f97316',
    borderBottomLeftRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    zIndex: 10,
  },
  bestValueText: {
    color: '#ffffff',
    fontSize: 7.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  quickRepeatCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  quickRepeatLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12,
  },
  quickRepeatIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  quickRepeatTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0d1b3e',
  },
  quickRepeatDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  bottomButtonWrapper: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    width: '100%',
  },
  purchaseBtn: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
    overflow: 'hidden',
  },
  purchaseBtnGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  purchaseBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
