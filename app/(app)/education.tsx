import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, Image, Modal, Linking, Platform, LayoutAnimation, StyleSheet } from 'react-native';
import { useState, useEffect } from 'react';
import { useNavigation } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { api } from '../../services/api';
import { supabase } from '../../services/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

// Import local assets
const logoWaec = require('../../assets/exams/waec.png');
const logoNeco = require('../../assets/exams/neco.jpg');
const logoJamb = require('../../assets/exams/jamb.png');
const logoNabteb = require('../../assets/exams/nabteb.png');

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
    const isWeb = Platform.OS === 'web';
    
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
    
    // Modernized UI states
    const [showGuide, setShowGuide] = useState(false);
    const [showAutoRenewInfo, setShowAutoRenewInfo] = useState(false);

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
        <View className="flex-1 bg-slate-50" style={isWeb && { backgroundColor: '#f4f6fb' }}>
            <StatusBar style="light" />

            {/* Modern Header */}
            <LinearGradient 
                colors={['#0f172a', '#334155']} 
                className="pt-14 pb-8 px-6 rounded-b-[40px] z-50 shadow-2xl shadow-slate-900/40"
                style={isWeb && { alignSelf: 'center', width: '100%', maxWidth: 450 }}
            >
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

            <ScrollView 
                style={isWeb ? { alignSelf: 'center', width: '100%', maxWidth: 450 } : { flex: 1 }}
                contentContainerStyle={[
                    { padding: 24, paddingBottom: 120 },
                    isWeb && { backgroundColor: '#ffffff', minHeight: '100%', shadowColor: '#0a1633', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 }
                ]}
            >
                {/* Exam Grid */}
                <View style={s.sectionHeader}>
                    <Text style={s.sectionTitle}>Select Provider</Text>
                    {fetchingPrices && <ActivityIndicator size="small" color="#4F46E5" />}
                </View>
                
                <View style={s.examGrid}>
                    {staticExams.map((e) => {
                        const isSelected = exam === e.id;
                        const liveData = prices.find(p => p.id === e.id);
                        
                        return (
                            <TouchableOpacity
                                key={e.id}
                                style={[
                                    s.examCard,
                                    isSelected && s.examCardSelected,
                                    isSelected && { borderColor: e.accent }
                                ]}
                                onPress={() => {
                                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                    setExam(e.id);
                                }}
                                activeOpacity={0.8}
                            >
                                <View style={s.examImageContainer}>
                                    <Image 
                                        source={e.image} 
                                        style={s.examImage} 
                                        resizeMode="contain" 
                                    />
                                </View>
                                
                                <LinearGradient 
                                    colors={isSelected ? [e.accent, e.accent + 'dd'] : ['#f8fafc', '#f1f5f9']}
                                    style={s.examCardFooter}
                                >
                                    <Text style={[s.examName, isSelected && s.examNameSelected]}>{e.name}</Text>
                                    <Text style={[s.examPrice, isSelected && s.examPriceSelected]}>
                                        {liveData ? `₦${liveData.price.toLocaleString()}` : '...'}
                                    </Text>
                                </LinearGradient>

                                {isSelected && (
                                    <View style={[s.checkmarkBubble, { backgroundColor: e.accent }]}>
                                        <Ionicons name="checkmark" size={11} color="white" />
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
                                    <View style={s.verifyCard}>
                                        <View style={s.verifyHeader}>
                                            <Ionicons name="checkmark-circle" size={18} color="#16a34a" style={{ marginRight: 6 }} />
                                            <Text style={s.verifyTitle}>Profile Verified Successfully</Text>
                                        </View>
                                        <View style={s.verifyDivider} />
                                        <View style={s.verifyRow}>
                                            <Text style={s.verifyLabel}>Candidate Name:</Text>
                                            <Text style={s.verifyValue}>{candidateName}</Text>
                                        </View>
                                        <View style={s.verifyRow}>
                                            <Text style={s.verifyLabel}>Provider Database:</Text>
                                            <Text style={s.verifyValue}>JAMB Nigeria (Direct Link)</Text>
                                        </View>
                                    </View>
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

                        {/* Gamified Bulk Discount Progress Tracker */}
                        <View style={s.discountTrackerContainer}>
                            <View style={s.discountTrackerHeader}>
                                <Ionicons name="gift-outline" size={16} color={isBulk ? '#16a34a' : '#4f46e5'} style={{ marginRight: 6 }} />
                                <Text style={[s.discountTrackerTitle, isBulk && { color: '#16a34a' }]}>
                                    {isBulk ? '🎉 Bulk Discount Active!' : 'Bulk Discount Progress'}
                                </Text>
                            </View>
                            
                            {/* Progress Bar */}
                            <View style={s.progressBarBackground}>
                                <View 
                                    style={[
                                        s.progressBarFill, 
                                        { 
                                            width: `${Math.min((quantity / 4) * 100, 100)}%`,
                                            backgroundColor: isBulk ? '#16a34a' : '#4f46e5'
                                        }
                                    ]} 
                                />
                            </View>
                            
                            <Text style={[s.discountTrackerHint, isBulk && { color: '#16a34a', fontWeight: '800' }]}>
                                {isBulk 
                                    ? `You saved ₦${discount.toLocaleString()} on this purchase!` 
                                    : `Buy ${4 - quantity} more PIN${4 - quantity > 1 ? 's' : ''} to unlock 5% Bulk Discount!`
                                }
                            </Text>
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
                            onPress={() => {
                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                setAutoRenew(!autoRenew);
                            }}
                            className={`flex-row items-center justify-between border rounded-xl px-4 py-4 mb-4 ${autoRenew ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200'}`}
                        >
                             <Text className={`font-bold ${autoRenew ? 'text-indigo-700' : 'text-slate-700'}`}>
                                {autoRenew ? 'Yes, Auto-Renew' : 'No'}
                             </Text>
                             <View className={`w-10 h-6 rounded-full px-0.5 justify-center ${autoRenew ? 'bg-indigo-600 items-end' : 'bg-slate-300 items-start'}`}>
                                <View className="w-5 h-5 rounded-full bg-white shadow-sm" />
                             </View>
                        </TouchableOpacity>

                        {autoRenew && (
                            <View style={s.autoRenewInfoContainer}>
                                <Ionicons name="information-circle-outline" size={16} color="#4f46e5" style={{ marginRight: 6, marginTop: 1 }} />
                                <Text style={s.autoRenewInfoText}>
                                    <Text style={{ fontWeight: '800' }}>Early Booking</Text>: We will automatically pre-order and reserve your exam PIN next year once registration starts to ensure you secure your spots early!
                                </Text>
                            </View>
                        )}

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

                {/* Result Checking Guides Collapsible Card */}
                <View style={s.guideContainer}>
                    <TouchableOpacity 
                        onPress={() => {
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            setShowGuide(!showGuide);
                        }}
                        style={s.guideHeader}
                        activeOpacity={0.8}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="school-outline" size={18} color="#4f46e5" style={{ marginRight: 8 }} />
                            <Text style={s.guideHeaderTitle}>Result-Checking Guides & Portals 🎓</Text>
                        </View>
                        <Ionicons 
                            name={showGuide ? "chevron-up" : "chevron-down"} 
                            size={16} 
                            color="#64748b" 
                        />
                    </TouchableOpacity>

                    {showGuide && (
                        <View style={s.guideContent}>
                            <Text style={s.guideText}>
                                Select a provider below to view result check guides and access their portals directly:
                            </Text>
                            
                            {staticExams.map((ex) => (
                                <View key={ex.id} style={s.guideItem}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                                        <Image source={ex.image} style={{ width: 18, height: 18, marginRight: 6 }} resizeMode="contain" />
                                        <Text style={s.guideItemTitle}>{ex.name} Result Check Guide:</Text>
                                    </View>
                                    <Text style={s.guideItemDesc}>{ex.guide}</Text>
                                    <TouchableOpacity 
                                        onPress={() => Linking.openURL(ex.portal)}
                                        style={[s.portalButton, { backgroundColor: ex.accent }]}
                                    >
                                        <Text style={s.portalButtonText}>Launch {ex.name} Portal</Text>
                                        <Ionicons name="open-outline" size={12} color="#ffffff" style={{ marginLeft: 4 }} />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

const s = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    marginLeft: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  examGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
    width: '100%',
  },
  examCard: {
    width: '48%',
    padding: 12,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    shadowColor: '#94a3b8',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    marginBottom: 16,
    overflow: 'hidden',
  },
  examCardSelected: {
    backgroundColor: '#f5f3ff',
    shadowColor: '#6366f1',
    shadowOpacity: 0.2,
    elevation: 4,
  },
  examImageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderRadius: 16,
  },
  examImage: {
    width: 72,
    height: 72,
  },
  examCardFooter: {
    borderRadius: 16,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  examName: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#334155',
    letterSpacing: 0.5,
  },
  examNameSelected: {
    color: '#ffffff',
  },
  examPrice: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    marginTop: 2,
  },
  examPriceSelected: {
    color: '#ffffff',
  },
  checkmarkBubble: {
    position: 'absolute',
    top: 8,
    right: 8,
    borderRadius: 10,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  verifyCard: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 16,
    padding: 12,
    marginTop: 8,
  },
  verifyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  verifyTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#166534',
  },
  verifyDivider: {
    height: 1,
    backgroundColor: '#dcfce7',
    marginVertical: 6,
  },
  verifyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  verifyLabel: {
    fontSize: 10.5,
    color: '#475569',
  },
  verifyValue: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#1e293b',
  },
  discountTrackerContainer: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    padding: 14,
    marginBottom: 24,
    width: '100%',
  },
  discountTrackerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  discountTrackerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  discountTrackerHint: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    textAlign: 'center',
  },
  autoRenewInfoContainer: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 16,
    padding: 12,
    marginTop: -8,
    marginBottom: 24,
    width: '100%',
  },
  autoRenewInfoText: {
    flex: 1,
    fontSize: 10.5,
    color: '#1e40af',
    lineHeight: 14,
  },
  guideContainer: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 24,
    marginTop: 16,
    overflow: 'hidden',
    width: '100%',
  },
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#f5f3ff',
  },
  guideHeaderTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#5b21b6',
  },
  guideContent: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderColor: '#ede9fe',
  },
  guideText: {
    fontSize: 10.5,
    color: '#475569',
    lineHeight: 14,
    marginBottom: 12,
  },
  guideItem: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    backgroundColor: '#f8fafc',
    marginBottom: 12,
  },
  guideItemTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1e293b',
  },
  guideItemDesc: {
    fontSize: 10.5,
    color: '#64748b',
    lineHeight: 14,
    marginTop: 4,
    marginBottom: 8,
  },
  portalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
  },
  portalButtonText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffffff',
  },
});
