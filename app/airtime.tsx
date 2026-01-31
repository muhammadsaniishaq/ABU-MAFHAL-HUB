import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform, Modal, FlatList, Switch } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../services/api';
import { supabase } from '../services/supabase';
import SecurityModal from '../components/SecurityModal';
import TransactionConfirmationModal from '../components/TransactionConfirmationModal';

// Network Assets & Data
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

export default function AirtimeScreen() {
    const [network, setNetwork] = useState('');
    const [amount, setAmount] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [showBeneficiaryModal, setShowBeneficiaryModal] = useState(false);
    const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
    const [balance, setBalance] = useState<number | null>(null);
    const [recents, setRecents] = useState<any[]>([]);
    
    // Modern Feature State
    const [userPhone, setUserPhone] = useState<string | null>(null);
    const [saveBeneficiary, setSaveBeneficiary] = useState(false);
    const [showSecurityModal, setShowSecurityModal] = useState(false);
    const [savingBen, setSavingBen] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    
    const router = useRouter();

    const presets = [100, 200, 500, 1000, 2000, 5000];

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            // Fetch Beneficiaries
            const { data: bens } = await supabase.from('beneficiaries').select('*').eq('user_id', user.id);
            if (bens) setBeneficiaries(bens);

            // Fetch Balance & Profile Info
            const { data: profile } = await supabase.from('profiles').select('balance, phone').eq('id', user.id).single();
            if (profile) {
                setBalance(profile.balance);
                if (profile.phone) setUserPhone(profile.phone);
            }

            // Fetch Recents (Success Airtime Txns)
            const { data: txns } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_id', user.id)
                .eq('type', 'airtime')
                .eq('status', 'success')
                .order('created_at', { ascending: false })
                .limit(20);

            if (txns) {
                const uniqueRecents: any[] = [];
                const seenPhones = new Set();
                
                txns.forEach((t: any) => {
                    // Desc format: "Airtime Purchase: MTN 080..."
                    const match = t.description?.match(/:\s*(\w+)\s+([\d+]+)/);
                    if (match) {
                        const net = match[1].toLowerCase(); // 'mtn'
                        const pho = match[2];
                        if (!seenPhones.has(pho)) {
                            seenPhones.add(pho);
                            uniqueRecents.push({ id: t.id, network: net, phone: pho });
                        }
                    }
                });
                setRecents(uniqueRecents.slice(0, 5)); // Keep top 5
            }
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

    // Helper to format amount
    const handleAmountChange = (text: string) => {
        // Remove non-numeric chars
        const clean = text.replace(/[^0-9]/g, '');
        setAmount(clean);
    };

    const handlePurchase = async () => {
        if (!network || !amount || phoneNumber.length < 10) return;

        if (balance !== null && Number(amount) > balance) {
            Alert.alert("Insufficient Funds", `Your wallet balance (₦${balance.toLocaleString()}) is insufficient for this transaction.`);
            return;
        }

        // Open Confirmation Modal instead of Security Modal directly
        setShowConfirmation(true);
    };

    const processTransaction = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not authenticated");
            
            // Save Beneficiary if selected
            if (saveBeneficiary) {
                // Check if already exists to avoid dupes? (Primitive check)
                const exists = beneficiaries.find(b => b.account_number === phoneNumber);
                if (!exists) {
                    await supabase.from('beneficiaries').insert({
                        user_id: user.id,
                        name: `My ${network.toUpperCase()} Line`, // Default Name
                        bank_name: network.toUpperCase(), // Treat Network as Bank Name
                        account_number: phoneNumber
                    });
                }
            }

            const result = await api.airtime.purchase(user.id, {
                network,
                phone: phoneNumber,
                amount: Number(amount)
            });

            if (result.success) {
                router.replace({
                    pathname: '/success',
                    params: {
                        amount: `₦${Number(amount).toLocaleString()}`,
                        type: 'Airtime Purchase',
                        reference: result.reference
                    }
                });
            }
        } catch (error: any) {
            console.error(error);
            Alert.alert("Error", error.message || "Something went wrong");
        } finally {
            setLoading(false);
            setShowSecurityModal(false);
        }
    };

    return (
        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 bg-gray-50"
        >
            <Stack.Screen options={{ title: 'Buy Airtime', headerTintColor: '#0056D2', headerStyle: { backgroundColor: '#fff' }, headerShadowVisible: false }} />
            <StatusBar style="dark" />

            <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingBottom: 40, paddingTop: 100 }}>
                
                {/* Balance Display - Modern Gradient */}
                {balance !== null && (
                    <LinearGradient
                        colors={['#2563EB', '#1D4ED8']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        className="mb-6 rounded-3xl p-5 flex-row justify-between items-center shadow-lg shadow-blue-300"
                    >
                        <View>
                            <Text className="text-blue-200 text-xs font-semibold mb-1 uppercase tracking-wider">Total Balance</Text>
                            <Text className="text-white text-3xl font-extrabold">₦{balance.toLocaleString()}</Text>
                        </View>
                        <View className="bg-white/10 p-3 rounded-2xl backdrop-blur-md border border-white/20">
                            <Ionicons name="wallet-outline" size={28} color="white" />
                        </View>
                    </LinearGradient>
                )}

                {/* Promotions Carousel */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-8 -mx-2">
                    {[
                        { id: 1, title: '2% Cashback', sub: 'On all MTN Airtime', color: '#FFCC00', text: '#000' },
                        { id: 2, title: 'Zero Fees', sub: 'Instant top-up', color: '#10B981', text: '#fff' },
                        { id: 3, title: 'N500 Bonus', sub: 'Refer a friend', color: '#8B5CF6', text: '#fff' }
                    ].map((promo, idx) => (
                        <View key={promo.id} className={`w-36 h-20 rounded-2xl p-3 justify-center mx-2 shadow-sm`} style={{ backgroundColor: promo.color }}>
                            <Text className="font-bold text-lg" style={{ color: promo.text }}>{promo.title}</Text>
                            <Text className="text-xs opacity-80" style={{ color: promo.text }}>{promo.sub}</Text>
                        </View>
                    ))}
                </ScrollView>

                {/* Recent Top-ups */}
                {recents.length > 0 && (
                    <View className="mb-6">
                        <Text className="text-gray-500 font-medium mb-3 text-sm ml-1">Recent Top-ups</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                            {recents.map((item) => (
                                <TouchableOpacity
                                    key={item.id}
                                    onPress={() => {
                                        setPhoneNumber(item.phone);
                                        detectNetwork(item.phone); // Auto-set network
                                    }}
                                    className="bg-white border border-gray-100 rounded-2xl p-3 mr-3 shadow-sm flex-row items-center space-x-2"
                                >
                                    <View className="w-8 h-8 rounded-full bg-gray-50 items-center justify-center border border-gray-200 overflow-hidden">
                                        {NETWORK_LOGOS[item.network] ? (
                                            <Image source={NETWORK_LOGOS[item.network]} className="w-full h-full" resizeMode="cover" />
                                        ) : (
                                            <Ionicons name="person" size={14} color="#9CA3AF" />
                                        )}
                                    </View>
                                    <View>
                                        <Text className="text-gray-800 font-bold text-xs">{item.phone}</Text>
                                        <Text className="text-gray-400 text-[10px] capitalize">{item.network}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* Network Section */}
                <Text className="text-gray-800 font-bold text-lg mb-4">Select Network</Text>
                <View className="flex-row justify-between mb-8">
                    {NETWORKS_DATA.map((net) => (
                        <TouchableOpacity
                            key={net.id}
                            className={`w-[22%] aspect-square rounded-2xl items-center justify-center border-2 bg-white shadow-sm ${
                                network === net.id ? 'border-blue-600 bg-blue-50' : 'border-transparent'
                            }`}
                            onPress={() => setNetwork(net.id)}
                            activeOpacity={0.7}
                        >
                            <Image 
                                source={NETWORK_LOGOS[net.id]} 
                                style={{ width: 40, height: 40 }}
                                className="mb-2 rounded-full" 
                                resizeMode="contain" 
                            />
                            {network === net.id && (
                                <View className="absolute top-1 right-1 bg-blue-600 rounded-full p-0.5">
                                    <Ionicons name="checkmark" size={10} color="white" />
                                </View>
                            )}
                            <Text className={`font-medium text-xs ${network === net.id ? 'text-blue-700' : 'text-gray-500'}`}>
                                {net.name}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Phone Input */}
                <Text className="text-gray-800 font-bold text-lg mb-3">Phone Number</Text>
                <View className={`flex-row items-center border-2 rounded-2xl px-4 h-16 bg-white mb-8 ${phoneNumber.length >= 10 ? 'border-green-500' : 'border-gray-200 focus:border-blue-500'}`}>
                    <View className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center mr-3 overflow-hidden">
                        {network ? (
                            <Image source={NETWORK_LOGOS[network]} className="w-full h-full" resizeMode="cover" />
                        ) : (
                             <Ionicons name="call" size={18} color="#9CA3AF" />
                        )}
                    </View>
                    <TextInput
                        className="flex-1 text-xl font-semibold text-gray-800"
                        keyboardType="phone-pad"
                        value={phoneNumber}
                        onChangeText={handlePhoneChange}
                        placeholder="08012345678"
                        placeholderTextColor="#94a3b8"
                        maxLength={11}
                        editable={!loading}
                    />
                    {userPhone && phoneNumber !== userPhone && (
                        <TouchableOpacity 
                            onPress={() => {
                                handlePhoneChange(userPhone);
                            }}
                            className="mr-2 px-3 py-1.5 bg-blue-100 rounded-lg"
                        >
                            <Text className="text-blue-700 font-bold text-xs">ME</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity 
                        onPress={() => setShowBeneficiaryModal(true)}
                        className="w-10 h-10 items-center justify-center bg-gray-50 rounded-full"
                    >
                        <Ionicons name="people" size={20} color="#0056D2" />
                    </TouchableOpacity>
                </View>

                {/* Save Beneficiary Toggle */}
                {/* Only show if phone is valid and NOT already in beneficiaries (simple check) */}
                {phoneNumber.length >= 10 && !beneficiaries.find(b => b.account_number === phoneNumber) && (
                    <View className="flex-row items-center justify-between mb-8 bg-gray-50 border border-gray-100 p-4 rounded-xl">
                        <View className="flex-row items-center">
                            <View className="bg-green-100 p-2 rounded-full mr-3">
                                <Ionicons name="save-outline" size={18} color="#166534" />
                            </View>
                            <View>
                                <Text className="font-semibold text-gray-700">Save Contact</Text>
                                <Text className="text-xs text-gray-500">Save for next time</Text>
                            </View>
                        </View>
                        <Switch
                            trackColor={{ false: "#E2E8F0", true: "#BBF7D0" }}
                            thumbColor={saveBeneficiary ? "#22C55E" : "#f4f3f4"}
                            onValueChange={setSaveBeneficiary}
                            value={saveBeneficiary}
                        />
                    </View>
                )}

                {/* Amount Input */}
                <Text className="text-gray-800 font-bold text-lg mb-3">Amount</Text>
                <View className="flex-row items-center border-2 border-gray-200 rounded-2xl px-4 h-16 bg-white mb-4 focus:border-blue-500">
                    <Text className="text-gray-400 text-2xl font-bold mr-2">₦</Text>
                    <TextInput
                        className="flex-1 text-3xl font-bold text-gray-800"
                        keyboardType="number-pad"
                        value={amount}
                        onChangeText={handleAmountChange}
                        placeholder="0.00"
                        placeholderTextColor="#cbd5e1"
                        editable={!loading}
                    />
                </View>

                {/* Features: Amount Presets Grid */}
                <Text className="text-gray-500 font-medium mb-3 text-sm ml-1">Quick Select Amount</Text>
                <View className="flex-row flex-wrap justify-between mb-8">
                    {presets.map((val) => (
                        <TouchableOpacity
                            key={val}
                            onPress={() => setAmount(val.toString())}
                            className="bg-white border border-gray-100 rounded-xl w-[31%] py-4 mb-3 shadow-sm active:bg-blue-50 items-center"
                        >
                            <Text className="text-blue-600 font-bold text-lg">₦{val}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Purchase Button - Modern Gradient */}
                <TouchableOpacity
                    onPress={handlePurchase}
                    disabled={!network || !amount || phoneNumber.length < 10 || loading}
                    activeOpacity={0.8}
                    className="shadow-xl shadow-blue-200"
                >
                    <LinearGradient
                        colors={ (!network || !amount || phoneNumber.length < 10 || loading) 
                             ? ['#E2E8F0', '#CBD5E1'] // Disabled Gray
                             : ['#2563EB', '#1D4ED8'] // Active Blue
                        }
                        className="h-16 rounded-2xl items-center justify-center flex-row"
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" size="small" />
                        ) : (
                            <>
                                <Text className={`font-bold text-xl mr-2 ${(!network || !amount || phoneNumber.length < 10) ? 'text-gray-400' : 'text-white'}`}>
                                    Pay securely
                                </Text>
                                <Ionicons 
                                    name="lock-closed" 
                                    size={18} 
                                    color={(!network || !amount || phoneNumber.length < 10) ? '#94A3B8' : 'white'} 
                                />
                            </>
                        )}
                    </LinearGradient>
                </TouchableOpacity>

                <View className="items-center mt-6 flex-row justify-center space-x-1">
                    <Ionicons name="shield-checkmark" size={14} color="#9CA3AF" />
                    <Text className="text-gray-400 text-xs">Secured by Flutterwave & Paystack</Text>
                </View>

            </ScrollView>

            <BeneficiaryModal />
            
            <TransactionConfirmationModal
                visible={showConfirmation}
                onClose={() => setShowConfirmation(false)}
                onConfirm={() => {
                    setShowConfirmation(false);
                    setTimeout(() => setShowSecurityModal(true), 500);
                }}
                title="Confirm Airtime Purchase"
                network={network}
                details={[
                    { label: 'Transaction Type', value: 'Airtime Top-up' },
                    { label: 'Network', value: NETWORKS_DATA.find(n => n.id === network)?.name || network },
                    { label: 'Phone Number', value: phoneNumber },
                    { label: 'Original Amount', value: `₦${Number(amount).toLocaleString()}`, isAmount: true },
                    { label: 'Discount (2%)', value: `-₦${(Number(amount) * 0.02).toLocaleString()}`, isDiscount: true },
                    { label: 'Total To Pay', value: `₦${(Number(amount) * 0.98).toLocaleString()}`, isTotal: true },
                ]}
            />
            
            <SecurityModal 
                visible={showSecurityModal}
                onClose={() => setShowSecurityModal(false)}
                onSuccess={() => {
                   processTransaction();
                }}
                title="Authorize Purchase"
                description={`Confirm ${network.toUpperCase()} Airtime\nTop-up of ₦${Number(amount).toLocaleString()}`}
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
                                        setPhoneNumber(item.account_number); // Using account_number as phone
                                        detectNetwork(item.account_number);
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
