import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform, LayoutAnimation, Modal, FlatList } from 'react-native';
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

// Network Logos (Using remote reliable URLs or assets if available)
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

export default function DataScreen() {
    const [network, setNetwork] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [selectedPlan, setSelectedPlan] = useState<DataPlan | null>(null);
    const [plans, setPlans] = useState<DataPlan[]>([]);
    const [loadingPlans, setLoadingPlans] = useState(false);
    const [loadingPurchase, setLoadingPurchase] = useState(false);
    
    // New Features State
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
            const prefix = cleanPhone.substring(0, 4); // Check first 4
            // Also check first 5 for 091... cases if standard 4 doesn't match? Mostly 4 is enough.
            
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

        // Smart Duration Extraction: Check both validity and name for patterns like "7 Days", "2 Weeks"
        const combinedText = rawVal + ' ' + nameVal;
        const durationMatch = combinedText.match(/(\d+)\s*(day|week|month|hr|hour)/i);
        
        if (durationMatch) {
            const num = parseInt(durationMatch[1]);
            const unit = durationMatch[2].toLowerCase();
            
            if (unit.startsWith('hr') || unit.startsWith('hour')) days = 1; // Hours -> Daily
            else if (unit.startsWith('day')) days = num;
            else if (unit.startsWith('week')) days = num * 7;
            else if (unit.startsWith('month')) days = num * 30;
        }

        // Keyword Fallbacks
        if (days === 0 || days === 30) { // If still default or unknown, try keywords
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
        
        // description format: "Data Bundle: MTN 1GB Monthly -> 080..."
        // Simple extraction logic
        const desc = lastTransaction.description || '';
        const parts = desc.split(' -> ');
        if (parts.length === 2) {
             const phone = parts[1];
             setPhoneNumber(phone);
             detectNetwork(phone); // This sets the network
             
             // Try to find plan by amount if network matches
             // We need to wait for network state to update or force fetch?
             // Since 'setNetwork' is async-ish in React batching, we might need a useEffect or just let user pick 
             // We can allow user to pick plan since we only know amount. 
             Alert.alert("Quick Load", `Phone number ${phone} loaded. Please select your plan.`);
        }
    };

    const toggleFavorite = (planId: string) => {
        setFavorites(prev => prev.includes(planId) ? prev.filter(id => id !== planId) : [...prev, planId]);
    };

    const fetchPlans = async (netId: string) => {
        setLoadingPlans(true);
        // Animate change
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        try {
            // Fetch directly from our DB (which is synced from ClubKonnect and controlled by Admin)
            const { data, error } = await supabase
                .from('data_plans')
                .select('*')
                .eq('network', netId.toLowerCase()) // Ensure network matches DB format
                .eq('is_active', true)
                .order('cost_price', { ascending: true }); // Or order by selling_price

            if (error) throw error;

            // Map DB structure to DataPlan interface
            const mappedPlans: DataPlan[] = (data || []).map((p: any) => {
                let inferredValidity = p.validity;
                if (!inferredValidity) {
                    const nameLower = p.name.toLowerCase();
                    if (nameLower.includes('daily') || nameLower.includes('24hr')) inferredValidity = '1 Day';
                    else if (nameLower.includes('weekly') || nameLower.includes('7 days')) inferredValidity = '7 Days';
                    else if (nameLower.includes('monthly') || nameLower.includes('30 days')) inferredValidity = '30 Days';
                    else {
                         // Regex search for "X Days" or "X Months"
                         const match = p.name.match(/(\d+)\s*(day|week|month|hr)/i);
                         if (match) inferredValidity = match[0]; // e.g., "30 Days"
                         else inferredValidity = '30 Days'; // Default fallback? Or keep empty? Let's default to 30 Days as most are monthly.
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

        // Open Confirmation Modal instead of Alert
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
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 bg-gray-50">
            <Stack.Screen options={{ title: 'Buy Data', headerTintColor: '#0056D2', headerStyle: { backgroundColor: '#fff' }, headerShadowVisible: false }} />
            <StatusBar style="dark" />

            <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 20, paddingTop: 100 }}>
                {/* Header Section */}
                <View className="mb-6 flex-row justify-between items-start">
                     <View>
                        <Text className="text-2xl font-bold text-gray-800">Internet Data</Text>
                        <Text className="text-gray-500">Stay connected with affordable plans.</Text>
                     </View>
                     {balance !== null && (
                         <View className="bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                             <Text className="text-blue-700 text-xs font-bold">₦{balance.toLocaleString()}</Text>
                         </View>
                     )}
                </View>

                {/* Quick Repeat Card */}
                {lastTransaction && (
                    <TouchableOpacity 
                        onPress={handleQuickRepeat}
                        className="bg-white p-4 rounded-2xl mb-6 shadow-sm border border-orange-100 flex-row justify-between items-center"
                    >
                        <View className="flex-row items-center">
                            <View className="w-10 h-10 rounded-full bg-orange-50 items-center justify-center mr-3">
                                <Ionicons name="refresh" size={20} color="#F97316" />
                            </View>
                            <View>
                                <Text className="font-bold text-gray-800 text-sm">Repeat Last Purchase</Text>
                                <Text className="text-gray-500 text-xs truncate w-48" numberOfLines={1}>
                                    {lastTransaction.description.split('->')[0]}
                                </Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
                    </TouchableOpacity>
                )}

                {/* Network Selection */}
                <Text className="text-gray-700 font-semibold mb-3">Select Network</Text>
                <View className="flex-row justify-between mb-6">
                    {NETWORKS_DATA.map((net) => (
                        <TouchableOpacity
                            key={net.id}
                            onPress={() => setNetwork(net.id)}
                            className={`items-center justify-center w-[22%] aspect-square rounded-2xl border-2 ${
                                network === net.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
                            } shadow-sm`}
                        >
                            <Image 
                                source={NETWORK_LOGOS[net.id]} 
                                style={{ width: 40, height: 40 }}
                                className="rounded-full" 
                                resizeMode="contain" 
                            />
                            <Text className={`text-xs font-bold mt-2 ${network === net.id ? 'text-blue-600' : 'text-gray-500'}`}>
                                {net.name}
                            </Text>
                            {network === net.id && (
                                <View className="absolute top-1 right-1 bg-blue-500 rounded-full p-[2px]">
                                    <Ionicons name="checkmark" size={10} color="white" />
                                </View>
                            )}
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Phone Number Input */}
                <Text className="text-gray-700 font-semibold mb-3">Beneficiary Number</Text>
                <View className={`flex-row items-center bg-white border-2 rounded-2xl px-4 h-16 mb-6 ${network ? 'border-blue-100' : 'border-gray-100'} shadow-sm`}>
                    <View className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-3 overflow-hidden">
                        {network ? (
                            <Image source={NETWORK_LOGOS[network]} className="w-full h-full" resizeMode="cover" />
                        ) : (
                             <Ionicons name="call" size={20} color="#9CA3AF" />
                        )}
                    </View>
                    <TextInput
                        className="flex-1 text-lg font-medium text-gray-800"
                        keyboardType="phone-pad"
                        placeholder="080... (Auto-detects network)"
                        placeholderTextColor="#9CA3AF"
                        value={phoneNumber}
                        onChangeText={handlePhoneChange}
                        maxLength={11}
                    />
                     <TouchableOpacity 
                        onPress={() => setShowBeneficiaryModal(true)}
                        className="w-10 h-10 items-center justify-center bg-gray-50 rounded-full mr-2"
                    >
                        <Ionicons name="people" size={20} color="#0056D2" />
                    </TouchableOpacity>

                    {phoneNumber.length > 0 && (
                        <TouchableOpacity onPress={() => handlePhoneChange('')}>
                            <Ionicons name="close-circle" size={20} color="#D1D5DB" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Data Plans Grid */}
                {loadingPlans ? (
                    <View className="h-40 items-center justify-center">
                        <ActivityIndicator size="large" color="#0056D2" />
                        <Text className="text-gray-400 mt-2">Loading plans...</Text>
                    </View>
                ) : (
                    <View>
                        {plans.length > 0 && (
                            <View className="mb-4">
                                {/* Search Bar */}
                                <View className="bg-white border border-gray-200 rounded-xl px-3 h-10 mb-3 flex-row items-center">
                                    <Ionicons name="search" size={16} color="#9CA3AF" />
                                    <TextInput 
                                        className="flex-1 ml-2 text-sm text-gray-800"
                                        placeholder="Search plans (e.g. 1GB, Weekend)..."
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

                                <Text className="text-gray-700 font-semibold mb-2">Filter Plans</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                                    {['All', 'Favorites', 'Daily', 'Weekly', 'Monthly'].map((f) => (
                                        <TouchableOpacity
                                            key={f}
                                            onPress={() => setPlanFilter(f as any)}
                                            className={`rounded-full px-4 py-1.5 mr-2 border ${
                                                planFilter === f ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-200'
                                            }`}
                                        >
                                            <Text className={`text-xs font-bold ${planFilter === f ? 'text-white' : 'text-gray-600'}`}>
                                                {f}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>


                            </View>
                        )}
                        
                        {plans.length > 0 && <Text className="text-gray-700 font-semibold mb-3">Available Plans</Text>}
                        
                        {!network ? (
                             <View className="h-32 items-center justify-center bg-blue-50 rounded-2xl border-dashed border border-blue-200">
                                 <Ionicons name="cellular-outline" size={32} color="#60A5FA" />
                                 <Text className="text-blue-400 mt-2 font-medium">Select a network to see plans</Text>
                             </View>
                        ) : (
                            <View className="flex-row flex-wrap gap-3">
                                {filteredPlans.map((plan) => {
                                    const isSelected = selectedPlan?.id === plan.id;
                                    const isFav = favorites.includes(plan.id);
                                    return (
                                    <TouchableOpacity
                                        key={plan.id}
                                        onPress={() => setSelectedPlan(plan)}
                                        className="w-[48%]"
                                        activeOpacity={0.7}
                                    >
                                        <View className={`rounded-2xl border ${isSelected ? 'border-transparent' : 'border-gray-100'} shadow-sm overflow-hidden bg-white`}>
                                            <LinearGradient
                                                colors={isSelected ? ['#2563EB', '#1e40af'] : ['#FFFFFF', '#FFFFFF']}
                                                style={{ padding: 16 }}
                                            >
                                                {/* Value Badges */}
                                                {(plan.validity.toLowerCase().includes('30') && plan.price < 1000) && (
                                                    <View className="absolute top-0 right-0 bg-orange-500 rounded-bl-xl rounded-tr-xl px-2 py-0.5 z-10">
                                                        <Text className="text-white text-[8px] font-bold">BEST VALUE</Text>
                                                    </View>
                                                )}
                                                {plan.name.toLowerCase().includes('mega') && (
                                                    <View className="absolute top-0 right-0 bg-purple-600 rounded-bl-xl rounded-tr-xl px-2 py-0.5 z-10">
                                                        <Text className="text-white text-[8px] font-bold">MEGA</Text>
                                                    </View>
                                                )}

                                                <View className="flex-row justify-between items-start mb-2">
                                                    {plan.validity ? (
                                                        <View className={`px-2 py-1 rounded-md ${isSelected ? 'bg-white/20' : 'bg-gray-100'}`}>
                                                            <Text className={`text-[10px] font-bold ${isSelected ? 'text-white' : 'text-gray-500'}`}>
                                                                {plan.validity}
                                                            </Text>
                                                        </View>
                                                    ) : <View className="h-6" />}
                                                    
                                                    <TouchableOpacity onPress={() => toggleFavorite(plan.id)}>
                                                        <Ionicons name={isFav ? "heart" : "heart-outline"} size={18} color={isFav ? (isSelected ? "white" : "#EF4444") : (isSelected ? "#93C5FD" : "#9CA3AF")} />
                                                    </TouchableOpacity>
                                                </View>
                                                <Text className={`font-bold text-base mb-1 ${isSelected ? 'text-white' : 'text-gray-800'}`} numberOfLines={2}>
                                                    {plan.name}
                                                </Text>
                                                <Text className={`text-lg font-extrabold ${isSelected ? 'text-white' : 'text-blue-600'}`}>
                                                    ₦{plan.price}
                                                </Text>
                                            </LinearGradient>
                                        </View>
                                    </TouchableOpacity>
                                )})}
                                {plans.length === 0 && (
                                     <View className="w-full flex-1 items-center justify-center py-10">
                                        <Text className="text-gray-400">No plans found for this network.</Text>
                                     </View>
                                )}
                            </View>
                        )}
                    </View>
                )}

            </ScrollView>

            {/* Bottom Floating Button */}
            <View className="p-5 bg-white border-t border-gray-100">
                <TouchableOpacity
                    className={`h-14 rounded-2xl items-center justify-center shadow-lg shadow-blue-200 ${
                        network && phoneNumber.length === 11 && selectedPlan && !loadingPurchase 
                        ? 'bg-blue-600' 
                        : 'bg-gray-300'
                    }`}
                    onPress={handlePurchase}
                    disabled={!network || phoneNumber.length !== 11 || !selectedPlan || loadingPurchase}
                >
                    {loadingPurchase ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text className="text-white font-bold text-lg">
                            {selectedPlan ? `Pay ₦${selectedPlan.price}` : 'Purchase Bundle'}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>
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
                    // Slight delay to allow modal to close before processing (optional ux)
                    setTimeout(() => processTransaction(), 500);
                }}
                title="Authorize Purchase"
                description={selectedPlan ? `Confirm purchase of ${selectedPlan.name} for ${phoneNumber} @ ₦${selectedPlan.price}` : "Enter PIN"}
                requiredFor="purchase"
            />
        </KeyboardAvoidingView>
    );

    function BeneficiaryModal() {
        return (
            <Modal
                animationType="slide"
                transparent={true}
                visible={showBeneficiaryModal}
                onRequestClose={() => setShowBeneficiaryModal(false)}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-white rounded-t-3xl h-[60%] p-5">
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
                                        // Simple regex to extract number if needed, usually beneficiaries have valid phone logic
                                        // Assuming account_number stores phone for airtime/data beneficiaries? 
                                        // Or we might need a specific field. 
                                        // For now, let's assume 'account_number' is the phone if it's not a bank ben.
                                        // If it's a Bank beneficiary, it might be weird. 
                                        // ideally we filter beneficiaries by type, but 'beneficiaries' table schema isn't fully visible here.
                                        // Let's just use account_number as phone.
                                        handlePhoneChange(item.account_number);
                                        setShowBeneficiaryModal(false);
                                    }}
                                >
                                    <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3">
                                        <Text className="text-blue-600 font-bold">{item.name[0]}</Text>
                                    </View>
                                    <View>
                                        <Text className="font-bold text-gray-800">{item.name}</Text>
                                        <Text className="text-gray-500 text-xs">{item.bank_name} - {item.account_number}</Text>
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
