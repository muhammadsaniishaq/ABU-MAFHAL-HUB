import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, Image, Modal, Linking } from 'react-native';
import { useState, useEffect } from 'react';
import { useNavigation } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { api } from '../services/api';
import { supabase } from '../services/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

// Import local assets
const logoWaec = require('../assets/exams/waec.png');
const logoNeco = require('../assets/exams/neco.jpg');
const logoJamb = require('../assets/exams/jamb.png');
const logoNabteb = require('../assets/exams/nabteb.png');

interface ExamPrice {
    id: string;
    name: string;
    price: number;
    currency?: string;
}

export default function EducationScreen() {
    const navigation = useNavigation();
    const [exam, setExam] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [loading, setLoading] = useState(false);
    const [fetchingPrices, setFetchingPrices] = useState(true);
    const [tickerIndex, setTickerIndex] = useState(0);
    const [promoCode, setPromoCode] = useState('');
    const [showHelp, setShowHelp] = useState(false);
    
    // JAMB Specific State
    const [profileId, setProfileId] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [jambType, setJambType] = useState('utme');
    const [verifyingProfile, setVerifyingProfile] = useState(false);
    const [profileVerified, setProfileVerified] = useState(false);
    const [candidateName, setCandidateName] = useState('');

    // New State for Wallet & Interactivity
    const [walletBalance, setWalletBalance] = useState(0);
    const [autoRenew, setAutoRenew] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);

    // Dynamic Prices State
    const [prices, setPrices] = useState<ExamPrice[]>([]);

    const staticExams = [
        { id: 'waec', name: 'WAEC', image: logoWaec, accent: '#1e3a8a', portal: 'https://waecdirect.org', guide: 'Visit waecdirect.org, enter PIN, Serial No, and Exam Year.' },
        { id: 'neco', name: 'NECO', image: logoNeco, accent: '#166534', portal: 'https://result.neco.gov.ng', guide: 'Go to result.neco.gov.ng, select year, and enter token.' },
        { id: 'jamb', name: 'JAMB', image: logoJamb, accent: '#15803d', portal: 'https://portal.jamb.gov.ng/efacility', guide: 'Visit portal.jamb.gov.ng/efacility to use your PIN.' },
        { id: 'nabteb', name: 'NABTEB', image: logoNabteb, accent: '#b45309', portal: 'https://eworld.nabtebnigeria.org', guide: 'Check via eworld.nabtebnigeria.org with your PIN.' },
    ];

    const tickers = [
        "📢 Real-time prices from ClubKonnect loaded.",
        "⚡ Bulk Discount: Buy 4+ PINs for 5% OFF!",
        "🎓 JAMB Direct Entry available now."
    ];

    useEffect(() => {
        fetchInitialData();
        const interval = setInterval(() => {
            setTickerIndex(prev => (prev + 1) % tickers.length);
        }, 4000);
        
        // Refresh wallet balance when screen focuses
        const unsubscribe = navigation.addListener('focus', () => {
             fetchInitialData();
        });

        return () => {
             clearInterval(interval);
             unsubscribe();
        };
    }, [navigation]);

    const fetchInitialData = async () => {
        setFetchingPrices(true);
        try {
             // 1. Fetch User Balance
             const { data: { user } } = await supabase.auth.getUser();
             if (user) {
                 const { data, error } = await supabase
                     .from('profiles')
                     .select('balance')
                     .eq('id', user.id)
                     .single();
                 
                 if (data) {
                     console.log("Wallet Balance Fetched:", data.balance);
                     setWalletBalance(data.balance);
                 } else if (error) {
                     console.warn("Failed to fetch balance:", error);
                 }
             }

            // 2. Fetch live prices from API (ClubKonnect)
            const livePrices = await api.education.getPrices();
            setPrices(livePrices);
        } catch (e) {
            console.error("Failed to load data", e);
            // Fallback for prices
            setPrices([
                { id: 'waec', name: 'WAEC', price: 3800 },
                { id: 'neco', name: 'NECO', price: 1200 },
                { id: 'jamb', name: 'JAMB', price: 4700 },
                { id: 'nabteb', name: 'NABTEB', price: 1000 },
            ]);
        } finally {
            setFetchingPrices(false);
            setInitialLoading(false);
        }
    };

    const getExamDetails = (id: string) => {
        const staticData = staticExams.find(e => e.id === id);
        const priceData = prices.find(p => p.id === id);
        return { 
            ...staticData, 
            price: priceData?.price || 0,
            currency: priceData?.currency || 'NGN',
            name: priceData?.name || staticData?.name || id.toUpperCase()
        };
    };

    const selectedExam = exam ? getExamDetails(exam) : null;
    
    // Calculate Total with Bulk Discount
    const getUnitPrice = () => {
        if (exam === 'jamb') {
            const options = {
                'de': 5700,
                'utme_mock': 8700,
                'utme': 7200
            };
            return options[jambType as keyof typeof options] || 4700;
        }
        return selectedExam?.price || 0;
    };

    const unitPrice = getUnitPrice();
    const baseTotal = unitPrice * quantity;
    const isBulk = quantity >= 4;
    const discount = isBulk ? baseTotal * 0.05 : 0;
    const total = baseTotal - discount;

    const handlePurchase = () => {
        if (!exam) return;

        Alert.alert(
            "Confirm Purchase",
            `Buy ${quantity} ${selectedExam?.name} PIN(s) for ₦${total.toLocaleString()}?${isBulk ? '\n(5% Bulk Discount Applied!)' : ''}`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Confirm", onPress: async () => {
                        await processTransaction();
                    }
                }
            ]
        );
    };

    const processTransaction = async () => {
        if (exam === 'jamb') {
            if (!profileId || profileId.length !== 10) {
                Alert.alert("Required", "Please enter a valid 10-digit Profile ID for JAMB.");
                return;
            }
            if (!phoneNumber || phoneNumber.length < 11) {
                 Alert.alert("Required", "Please enter a valid 11-digit Phone Number.");
                 return;
            }
            if (!profileVerified) {
                Alert.alert("Verify Profile", "Please verify the Profile ID before purchasing.");
                return;
            }
        }

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not authenticated");

            // Determine effective exam type for API
            // For JAMB, we use the specific type (utme/de)
            // For others, we use the exam ID (waec, neco, etc.)
            const effectiveExamType = exam === 'jamb' ? jambType : exam;

            const result = await api.education.purchase(user.id, {
                examType: effectiveExamType,
                quantity: quantity,
                amount: total,
                profileId: exam === 'jamb' ? profileId : undefined,
                phone: phoneNumber
            });

            if (result.success) {
                Alert.alert("Success", "PIN generated successfully! Check your dashboard/history.");
                setExam(''); 
                setQuantity(1);
                // Reset JAMB fields
                setProfileId('');
                setProfileVerified(false);
                setCandidateName('');
            } else {
                Alert.alert("Failed", "Could not purchase PIN.");
            }
        } catch (error: any) {
            console.error(error);
            Alert.alert("Error", error.message || "An error occurred");
        }
        setLoading(false);
    };

    return (
        <View className="flex-1 bg-slate-50">
            <StatusBar style="light" />

            {/* Modern Header */}
            <LinearGradient colors={['#0f172a', '#334155']} className="pt-14 pb-8 px-6 rounded-b-[40px] z-50 shadow-2xl shadow-slate-900/40">
                <View className="flex-row items-center justify-between mb-6">
                    <TouchableOpacity onPress={() => navigation?.goBack?.()} className="bg-white/10 p-3 rounded-full backdrop-blur-md border border-white/5">
                        <Ionicons name="arrow-back" size={24} color="white" />
                    </TouchableOpacity>
                    <View className="items-center">
                        <Text className="text-white text-2xl font-black tracking-tight">Exam Portal</Text>
                        <Text className="text-blue-200 text-xs font-bold uppercase tracking-widest mt-0.5">ClubKonnect Verified</Text>
                    </View>
                    <TouchableOpacity onPress={() => setShowHelp(true)} className="bg-white/10 p-3 rounded-full backdrop-blur-md border border-white/5">
                        <Ionicons name="help" size={24} color="white" />
                    </TouchableOpacity>
                </View>
                
                {/* Live Ticker */}
                <View className="bg-black/20 rounded-2xl px-4 py-3 flex-row items-center backdrop-blur-sm border border-white/5">
                    <View className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-3 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                    <Text className="text-white/90 text-xs font-bold tracking-wide flex-1" numberOfLines={1}>
                        {tickers[tickerIndex]}
                    </Text>
                </View>
            </LinearGradient>

            <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingBottom: 120 }}>
                {/* Exam Grid */}
                <View className="flex-row items-center justify-between mb-4 ml-1">
                    <Text className="text-slate-800 font-black text-lg">Select Provider</Text>
                    {fetchingPrices && <ActivityIndicator size="small" color="#4F46E5" />}
                </View>
                
                <View className="flex-row flex-wrap gap-4 mb-8">
                    {staticExams.map((e) => {
                        const isSelected = exam === e.id;
                        const liveData = prices.find(p => p.id === e.id);
                        
                        return (
                            <TouchableOpacity
                                key={e.id}
                                className={`w-[47%] h-64 rounded-[32px] overflow-hidden border relative ${isSelected ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-200 bg-white'}`}
                                onPress={() => setExam(e.id)}
                                style={{ 
                                    elevation: isSelected ? 8 : 2,
                                    shadowColor: isSelected ? '#6366f1' : '#94a3b8',
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: isSelected ? 0.3 : 0.1,
                                    shadowRadius: 12,
                                    transform: [{ scale: isSelected ? 1.02 : 1 }]
                                }}
                            >
                                <View className="flex-1 items-center justify-center p-2 bg-white/50">
                                    <Image 
                                        source={e.image} 
                                        className="w-32 h-32" 
                                        resizeMode="contain" 
                                    />
                                </View>
                                
                                <LinearGradient 
                                    colors={isSelected ? ['#4F46E5', '#4338ca'] : ['#f8fafc', '#f1f5f9']}
                                    className="py-3 items-center justify-center border-t border-slate-100"
                                >
                                    <Text className={`font-black text-sm tracking-wider ${isSelected ? 'text-white' : 'text-slate-700'}`}>{e.name}</Text>
                                    <Text className={`text-[11px] font-bold mt-0.5 ${isSelected ? 'text-white/90' : 'text-slate-400'}`}>
                                        {liveData ? `₦${liveData.price.toLocaleString()}` : '...'}
                                    </Text>
                                </LinearGradient>

                                {isSelected && (
                                    <View className="absolute top-3 right-3 bg-indigo-600 rounded-full p-1.5 shadow-lg z-10 border-2 border-white">
                                        <Ionicons name="checkmark" size={12} color="white" />
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Purchase Action Block */}
                {selectedExam && (
                    <View className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 mb-8 animate-fade-in">
                        
                        {/* 1. PAYMENT OPTION */}
                        <Text className="text-slate-500 font-bold text-xs uppercase tracking-widest mb-2">PAYMENT OPTION</Text>
                        <View className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 mb-6">
                             <Text className="font-bold text-slate-700 text-base">
                                Wallet - <Text className={walletBalance >= total ? 'text-slate-700' : 'text-red-500'}>₦{walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                             </Text> 
                        </View>

                        {/* 2. EXAM TYPE */}
                        {exam === 'jamb' ? (
                            <View className="mb-6">
                                <Text className="text-slate-500 font-bold text-xs uppercase tracking-widest mb-2">Select JAMB Type</Text>
                                <View className="gap-2 mb-4">
                                    {[
                                        { id: 'de', label: 'Direct Entry (DE)', price: 5700 },
                                        { id: 'utme_mock', label: 'UTME PIN (with mock)', price: 8700 },
                                        { id: 'utme', label: 'UTME PIN (without mock)', price: 7200 }
                                    ].map((opt) => (
                                        <TouchableOpacity 
                                            key={opt.id}
                                            onPress={() => setJambType(opt.id)}
                                            className={`flex-row justify-between items-center py-3.5 px-4 rounded-xl border ${jambType === opt.id ? 'bg-indigo-50 border-indigo-500' : 'bg-slate-50 border-slate-200'}`}
                                        >
                                            <Text className={`font-bold ${jambType === opt.id ? 'text-indigo-700' : 'text-slate-600'}`}>
                                                {opt.label}
                                            </Text>
                                            <Text className={`font-black ${jambType === opt.id ? 'text-indigo-600' : 'text-slate-400'}`}>
                                                ₦{opt.price.toLocaleString()}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        ) : (
                            <View className="mb-6">
                                <Text className="text-slate-500 font-bold text-xs uppercase tracking-widest mb-2">Exam Type</Text>
                                <View className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-4">
                                     <Text className="font-bold text-slate-700">{selectedExam.name} - ₦{Math.floor(total / quantity).toLocaleString()}</Text> 
                                </View>
                            </View>
                        )}

                        {/* JAMB Profile ID (Inline) */}
                        {exam === 'jamb' && (
                            <View className="mb-6">
                                <Text className="text-slate-500 font-bold text-xs uppercase tracking-widest mb-2">JAMB Profile ID</Text>
                                <View className="flex-row gap-2 mb-1">
                                    <TextInput
                                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 font-bold text-slate-800"
                                        placeholder="Enter 10-digit Profile ID"
                                        keyboardType="numeric"
                                        maxLength={10}
                                        value={profileId}
                                        onChangeText={(text) => {
                                            setProfileId(text);
                                            setProfileVerified(false);
                                            setCandidateName('');
                                        }}
                                    />
                                    <TouchableOpacity 
                                        disabled={profileId.length !== 10 || verifyingProfile || profileVerified}
                                        onPress={async () => {
                                            setVerifyingProfile(true);
                                            try {
                                                 const result = await (api.education as any).verifyProfile(exam, profileId);
                                                 if (result.isValid) {
                                                     setProfileVerified(true);
                                                     setCandidateName(result.customerName || 'Verified Candidate');
                                                     Alert.alert("Success", `Profile Verified: ${result.customerName || 'Valid ID'}`);
                                                 } else {
                                                     Alert.alert("Invalid", result.message || "Profile ID not found");
                                                 }
                                            } catch (e) {
                                                Alert.alert("Error", "Verification failed");
                                            }
                                            setVerifyingProfile(false);
                                        }}
                                        className={`px-4 rounded-xl justify-center items-center ${profileVerified ? 'bg-green-500' : 'bg-indigo-600'} ${profileId.length !== 10 ? 'opacity-50' : ''}`}
                                    >
                                        {verifyingProfile ? (
                                            <ActivityIndicator color="white" size="small" />
                                        ) : profileVerified ? (
                                            <Ionicons name="checkmark" size={20} color="white" />
                                        ) : (
                                            <Text className="text-white font-bold text-xs">Verify</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                                {candidateName ? (
                                    <Text className="text-green-600 text-xs font-bold ml-1">✓ {candidateName}</Text>
                                ) : null}
                            </View>
                        )}

                        {/* 3. PHONE NUMBER */}
                        <Text className="text-slate-500 font-bold text-xs uppercase tracking-widest mb-2">PHONE NUMBER</Text>
                        <TextInput
                            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 font-bold text-slate-800 mb-6"
                            placeholder="Enter Phone Number"
                            keyboardType="phone-pad"
                            maxLength={11}
                            value={phoneNumber}
                            onChangeText={setPhoneNumber}
                        />

                        {/* 4. QUANTITY (Optional but useful, user didn't ask to remove) */}
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-slate-500 font-bold text-xs uppercase tracking-widest">Quantity</Text>
                            <View className="flex-row items-center bg-slate-50 rounded-xl p-1 border border-slate-200">
                                <TouchableOpacity onPress={() => quantity > 1 && setQuantity(q => q - 1)} className="w-10 h-10 items-center justify-center bg-white rounded-lg shadow-sm">
                                    <Ionicons name="remove" size={20} color="#334155" />
                                </TouchableOpacity>
                                <Text className="w-12 text-center font-bold text-slate-800 text-lg">{quantity}</Text>
                                <TouchableOpacity onPress={() => setQuantity(q => q + 1)} className="w-10 h-10 items-center justify-center bg-white rounded-lg shadow-sm">
                                    <Ionicons name="add" size={20} color="#334155" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* 5. AMOUNT */}
                        <View className="flex-row items-center mb-2">
                             <Text className="text-slate-500 font-bold text-xs uppercase tracking-widest mr-1">AMOUNT</Text>
                             {isBulk && <Text className="text-red-500 font-bold text-xs">[5.00% Discount]</Text>}
                        </View>
                        <View className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 mb-6">
                             <Text className="font-bold text-slate-700">₦{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                        </View>

                        {/* 6. AUTO RENEW */}
                        <Text className="text-slate-500 font-bold text-xs uppercase tracking-widest mb-2">AUTO RENEW</Text>
                        <TouchableOpacity 
                            onPress={() => setAutoRenew(!autoRenew)}
                            className={`flex-row items-center justify-between border rounded-xl px-4 py-4 mb-8 ${autoRenew ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200'}`}
                        >
                             <Text className={`font-bold ${autoRenew ? 'text-indigo-700' : 'text-slate-700'}`}>
                                {autoRenew ? 'Yes, Auto-Renew' : 'No'}
                             </Text>
                             <View className={`w-10 h-6 rounded-full px-0.5 justify-center ${autoRenew ? 'bg-indigo-600 items-end' : 'bg-slate-300 items-start'}`}>
                                <View className="w-5 h-5 rounded-full bg-white shadow-sm" />
                             </View>
                        </TouchableOpacity>

                        {/* 7. PAY NOW BUTTON */}
                        <TouchableOpacity
                            className={`py-4 rounded-xl items-center justify-center shadow-lg shadow-indigo-300/50 ${loading ? 'bg-indigo-400' : 'bg-indigo-600'}`}
                            onPress={handlePurchase}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color="white" />
                            ) : (
                                <Text className="text-white font-black text-lg uppercase tracking-widest">PAY NOW</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>

            {/* Help Modal */}
             <Modal visible={showHelp} transparent animationType="fade" onRequestClose={() => setShowHelp(false)}>
                <BlurView intensity={40} tint="dark" className="flex-1 items-center justify-center p-6">
                    <View className="bg-white w-full rounded-[32px] p-8 shadow-2xl">
                        <View className="w-16 h-16 bg-indigo-50 rounded-full items-center justify-center self-center mb-6">
                            <Ionicons name="information" size={32} color="#4F46E5" />
                        </View>
                        <Text className="text-2xl font-black text-center text-slate-900 mb-2">How to Use</Text>
                        <Text className="text-slate-500 text-center font-medium leading-7 mb-8 px-4">
                            {selectedExam?.guide || 'Select an exam provider to see specific instructions on how to use the PIN and check your result.'}
                        </Text>
                        <TouchableOpacity onPress={() => setShowHelp(false)} className="bg-slate-900 py-4 rounded-2xl items-center shadow-lg shadow-slate-900/20">
                            <Text className="text-white font-bold text-lg">Got it, thanks!</Text>
                        </TouchableOpacity>
                    </View>
                </BlurView>
            </Modal>
        </View>
    );
}
