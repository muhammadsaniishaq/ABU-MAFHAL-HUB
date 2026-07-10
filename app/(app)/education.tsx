import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, Image, Modal, Linking, Platform, LayoutAnimation, StyleSheet } from 'react-native';
import { useState, useEffect } from 'react';
import { useNavigation } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { api } from '../../services/api';
import { supabase } from '../../services/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

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

const T = {
    navy: '#0d1b3e',
    navyLight: '#1a2a54',
    gold: '#f5a623',
    goldLight: '#fcd34d',
    white: '#ffffff',
    bg: '#f4f6fb',
    text: '#334155',
    textLight: '#64748b'
};

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
    
    // Modernized UI states
    const [showGuide, setShowGuide] = useState(false);

    // Dynamic Prices State
    const [prices, setPrices] = useState<ExamPrice[]>([]);

    const staticExams = [
        { id: 'waec', name: 'WAEC', image: logoWaec, accent: T.navy, portal: 'https://waecdirect.org', guide: 'Visit waecdirect.org, enter PIN, Serial No, and Exam Year.' },
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
                     setWalletBalance(data.balance);
                 }
             }

            // 2. Fetch live prices from API (ClubKonnect)
            const livePrices = await api.education.getPrices();
            setPrices(livePrices || []);
        } catch (e) {
            console.error("Failed to load data", e);
        } finally {
            setFetchingPrices(false);
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
            const jambPkg = prices.find(p => p.id === jambType);
            return jambPkg ? jambPkg.price : 0;
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
        if (total <= 0) {
             Alert.alert("Error", "Price not available for this exam. Please try again later.");
             return;
        }

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

    const jambOptions = prices.filter(p => ['de', 'utme_mock', 'utme'].includes(p.id));

    return (
        <View style={[s.container, isWeb && { backgroundColor: T.bg }]}>
            <StatusBar style="light" />

            <LinearGradient 
                colors={[T.navy, T.navyLight]} 
                style={[s.headerContainer, isWeb && { alignSelf: 'center', width: '100%', maxWidth: 450 }]}
            >
                <View style={s.headerTopRow}>
                    <TouchableOpacity onPress={() => navigation?.goBack?.()} style={s.headerIconBtn}>
                        <Ionicons name="arrow-back" size={24} color={T.white} />
                    </TouchableOpacity>
                    <View style={s.headerTitleContainer}>
                        <Text style={s.headerTitle}>Exam Portal</Text>
                        <Text style={s.headerSubtitle}>ClubKonnect Verified</Text>
                    </View>
                    <TouchableOpacity onPress={() => setShowHelp(true)} style={s.headerIconBtn}>
                        <Ionicons name="help" size={24} color={T.white} />
                    </TouchableOpacity>
                </View>
                
                <View style={s.tickerContainer}>
                    <View style={s.tickerDot} />
                    <Text style={s.tickerText} numberOfLines={1}>
                        {tickers[tickerIndex]}
                    </Text>
                </View>
            </LinearGradient>

            <ScrollView 
                style={isWeb ? { alignSelf: 'center', width: '100%', maxWidth: 450 } : { flex: 1 }}
                contentContainerStyle={[
                    { padding: 24, paddingBottom: 120 },
                    isWeb && { backgroundColor: T.white, minHeight: '100%', shadowColor: '#0a1633', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 }
                ]}
            >
                <View style={s.sectionHeader}>
                    <Text style={s.sectionTitle}>Select Provider</Text>
                    {fetchingPrices && <ActivityIndicator size="small" color={T.gold} />}
                </View>

                {/* 4 Grid Columns layout */}
                <View style={s.examGrid}>
                    {staticExams.map((e) => {
                        const isSelected = exam === e.id;
                        const liveData = prices.find(p => p.id === e.id || p.id === (e.id === 'waec' ? 'waecdirect' : e.id));
                        return (
                            <TouchableOpacity 
                                key={e.id}
                                onPress={() => {
                                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                    setExam(e.id);
                                }}
                                style={[
                                    s.examCard, 
                                    isSelected && s.examCardSelected
                                ]}
                                activeOpacity={0.8}
                            >
                                <View style={s.examImageContainer}>
                                    <Image source={e.image} style={s.examImage} resizeMode="contain" />
                                </View>
                                
                                <LinearGradient
                                    colors={isSelected ? [T.navy, T.navyLight] : [T.bg, T.bg]}
                                    style={s.examCardFooter}
                                >
                                    <Text style={[s.examName, isSelected && s.examNameSelected]}>{e.name}</Text>
                                    <Text style={[s.examPrice, isSelected && s.examPriceSelected]}>
                                        {liveData ? `₦${liveData.price.toLocaleString()}` : '...'}
                                    </Text>
                                </LinearGradient>

                                {isSelected && (
                                    <View style={[s.checkmarkBubble, { backgroundColor: T.gold }]}>
                                        <Ionicons name="checkmark" size={11} color={T.navy} />
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Purchase Action Block */}
                {selectedExam && (
                    <View style={s.actionBlock}>
                        
                        <Text style={s.label}>PAYMENT OPTION</Text>
                        <View style={s.walletBox}>
                             <Text style={s.walletText}>
                                Wallet - <Text style={walletBalance >= total ? s.walletText : s.errorText}>₦{walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                             </Text> 
                        </View>

                        {exam === 'jamb' ? (
                            <View style={s.inputGroup}>
                                <Text style={s.label}>Select JAMB Type</Text>
                                <View style={{ gap: 8 }}>
                                    {jambOptions.length > 0 ? jambOptions.map((opt) => (
                                        <TouchableOpacity 
                                            key={opt.id}
                                            onPress={() => setJambType(opt.id)}
                                            style={[
                                                s.jambOption,
                                                jambType === opt.id && s.jambOptionSelected
                                            ]}
                                        >
                                            <Text style={[s.jambOptionText, jambType === opt.id && s.jambOptionTextSelected]}>
                                                {opt.name}
                                            </Text>
                                            <Text style={[s.jambOptionPrice, jambType === opt.id && s.jambOptionTextSelected]}>
                                                ₦{opt.price.toLocaleString()}
                                            </Text>
                                        </TouchableOpacity>
                                    )) : <Text style={s.errorText}>Loading JAMB prices...</Text>}
                                </View>
                            </View>
                        ) : (
                            <View style={s.inputGroup}>
                                <Text style={s.label}>Exam Type</Text>
                                <View style={s.infoBox}>
                                     <Text style={s.infoBoxText}>{selectedExam.name} - ₦{Math.floor(total / quantity).toLocaleString()}</Text> 
                                </View>
                            </View>
                        )}

                        {exam === 'jamb' && (
                            <View style={s.inputGroup}>
                                <Text style={s.label}>JAMB Profile ID</Text>
                                <View style={s.verifyRowContainer}>
                                    <TextInput
                                        style={s.input}
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
                                        style={[
                                            s.verifyBtn,
                                            profileVerified ? s.verifyBtnSuccess : s.verifyBtnDefault,
                                            profileId.length !== 10 && { opacity: 0.5 }
                                        ]}
                                    >
                                        {verifyingProfile ? (
                                            <ActivityIndicator color={T.white} size="small" />
                                        ) : profileVerified ? (
                                            <Ionicons name="checkmark" size={20} color={T.white} />
                                        ) : (
                                            <Text style={s.verifyBtnText}>Verify</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                                {candidateName ? (
                                    <View style={s.verifyResultCard}>
                                        <View style={s.verifyResultHeader}>
                                            <Ionicons name="checkmark-circle" size={18} color="#16a34a" style={{ marginRight: 6 }} />
                                            <Text style={s.verifyResultTitle}>Profile Verified Successfully</Text>
                                        </View>
                                        <View style={s.verifyResultDivider} />
                                        <View style={s.verifyResultRow}>
                                            <Text style={s.verifyResultLabel}>Candidate Name:</Text>
                                            <Text style={s.verifyResultValue}>{candidateName}</Text>
                                        </View>
                                    </View>
                                ) : null}
                            </View>
                        )}

                        <Text style={s.label}>PHONE NUMBER</Text>
                        <TextInput
                            style={[s.input, { marginBottom: 24 }]}
                            placeholder="Enter Phone Number"
                            keyboardType="phone-pad"
                            maxLength={11}
                            value={phoneNumber}
                            onChangeText={setPhoneNumber}
                        />

                        <View style={s.quantityContainer}>
                            <Text style={s.label}>Quantity</Text>
                            <View style={s.quantityControls}>
                                <TouchableOpacity onPress={() => quantity > 1 && setQuantity(q => q - 1)} style={s.quantityBtn}>
                                    <Ionicons name="remove" size={20} color={T.text} />
                                </TouchableOpacity>
                                <Text style={s.quantityText}>{quantity}</Text>
                                <TouchableOpacity onPress={() => setQuantity(q => q + 1)} style={s.quantityBtn}>
                                    <Ionicons name="add" size={20} color={T.text} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Gamified Bulk Discount Progress Tracker */}
                        <View style={s.discountTrackerContainer}>
                            <View style={s.discountTrackerHeader}>
                                <Ionicons name="gift-outline" size={16} color={isBulk ? '#16a34a' : T.gold} style={{ marginRight: 6 }} />
                                <Text style={[s.discountTrackerTitle, isBulk && { color: '#16a34a' }]}>
                                    {isBulk ? '🎉 Bulk Discount Active!' : 'Bulk Discount Progress'}
                                </Text>
                            </View>
                            
                            <View style={s.progressBarBackground}>
                                <View 
                                    style={[
                                        s.progressBarFill, 
                                        { 
                                            width: `${Math.min((quantity / 4) * 100, 100)}%`,
                                            backgroundColor: isBulk ? '#16a34a' : T.gold
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

                        <View style={s.amountLabelRow}>
                             <Text style={[s.label, { marginBottom: 0 }]}>AMOUNT</Text>
                             {isBulk && <Text style={s.discountTag}>[5.00% Discount]</Text>}
                        </View>
                        <View style={s.amountBox}>
                             <Text style={s.amountText}>₦{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                        </View>

                        <Text style={s.label}>AUTO RENEW</Text>
                        <TouchableOpacity 
                            onPress={() => {
                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                setAutoRenew(!autoRenew);
                            }}
                            style={[s.autoRenewBtn, autoRenew && s.autoRenewBtnActive]}
                        >
                             <Text style={[s.autoRenewText, autoRenew && s.autoRenewTextActive]}>
                                {autoRenew ? 'Yes, Auto-Renew' : 'No'}
                             </Text>
                             <View style={[s.autoRenewToggle, autoRenew && s.autoRenewToggleActive]}>
                                <View style={s.autoRenewToggleThumb} />
                             </View>
                        </TouchableOpacity>

                        {autoRenew && (
                            <View style={s.autoRenewInfoContainer}>
                                <Ionicons name="information-circle-outline" size={16} color={T.navy} style={{ marginRight: 6, marginTop: 1 }} />
                                <Text style={s.autoRenewInfoText}>
                                    <Text style={{ fontWeight: '800' }}>Early Booking</Text>: We will automatically pre-order and reserve your exam PIN next year once registration starts to ensure you secure your spots early!
                                </Text>
                            </View>
                        )}

                        <TouchableOpacity
                            style={[s.payBtn, loading && { opacity: 0.7 }]}
                            onPress={handlePurchase}
                            disabled={loading || total <= 0}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color={T.navy} />
                            ) : (
                                <Text style={s.payBtnText}>PAY NOW</Text>
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
                            <Ionicons name="school-outline" size={18} color={T.navy} style={{ marginRight: 8 }} />
                            <Text style={s.guideHeaderTitle}>Result-Checking Guides & Portals 🎓</Text>
                        </View>
                        <Ionicons 
                            name={showGuide ? "chevron-up" : "chevron-down"} 
                            size={16} 
                            color={T.textLight} 
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
                                        style={[s.portalButton, { backgroundColor: T.navy }]}
                                    >
                                        <Text style={s.portalButtonText}>Launch {ex.name} Portal</Text>
                                        <Ionicons name="open-outline" size={12} color={T.gold} style={{ marginLeft: 4 }} />
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
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    headerContainer: {
        paddingTop: 56,
        paddingBottom: 32,
        paddingHorizontal: 24,
        borderBottomLeftRadius: 40,
        borderBottomRightRadius: 40,
        zIndex: 50,
        shadowColor: T.navy,
        shadowOpacity: 0.4,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
    },
    headerTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    headerIconBtn: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        padding: 12,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    headerTitleContainer: {
        alignItems: 'center',
    },
    headerTitle: {
        color: T.white,
        fontSize: 24,
        fontWeight: '900',
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        color: T.gold,
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        marginTop: 2,
    },
    tickerContainer: {
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    tickerDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: T.gold,
        marginRight: 12,
        shadowColor: T.gold,
        shadowOpacity: 0.6,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 },
    },
    tickerText: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.5,
        flex: 1,
    },
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
        color: T.navy,
    },
    examGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 24,
        width: '100%',
    },
    examCard: {
        width: '23%', 
        padding: 6,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: '#cbd5e1',
        backgroundColor: '#ffffff',
        alignItems: 'center',
    },
    examCardSelected: {
        borderColor: T.gold,
        shadowColor: T.gold,
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    examImageContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        width: '100%',
    },
    examImage: {
        width: 36,
        height: 36,
    },
    examCardFooter: {
        borderRadius: 10,
        paddingVertical: 6,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        marginTop: 6,
    },
    examName: {
        fontSize: 9,
        fontWeight: '900',
        color: T.text,
        textAlign: 'center',
    },
    examNameSelected: {
        color: T.white,
    },
    examPrice: {
        fontSize: 9,
        fontWeight: '800',
        color: T.textLight,
        marginTop: 2,
    },
    examPriceSelected: {
        color: T.goldLight,
    },
    checkmarkBubble: {
        position: 'absolute',
        top: -6,
        right: -6,
        borderRadius: 10,
        width: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: T.white,
    },
    actionBlock: {
        backgroundColor: T.white,
        padding: 24,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: T.navy,
        shadowOpacity: 0.05,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 2,
        marginBottom: 24,
    },
    label: {
        color: T.textLight,
        fontWeight: '800',
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        marginBottom: 8,
    },
    walletBox: {
        backgroundColor: T.bg,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
    },
    walletText: {
        fontWeight: '800',
        color: T.navy,
        fontSize: 14,
    },
    errorText: {
        color: '#ef4444',
    },
    inputGroup: {
        marginBottom: 24,
    },
    jambOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: T.bg,
    },
    jambOptionSelected: {
        backgroundColor: '#fffbeb',
        borderColor: T.gold,
    },
    jambOptionText: {
        fontWeight: '800',
        color: T.text,
        fontSize: 13,
    },
    jambOptionTextSelected: {
        color: T.navy,
    },
    jambOptionPrice: {
        fontWeight: '900',
        color: T.textLight,
        fontSize: 13,
    },
    jambOptionPriceSelected: {
        color: T.navy,
    },
    infoBox: {
        backgroundColor: T.bg,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 16,
        padding: 16,
    },
    infoBoxText: {
        fontWeight: '800',
        color: T.navy,
    },
    verifyRowContainer: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 4,
    },
    input: {
        flex: 1,
        backgroundColor: T.bg,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontWeight: '800',
        color: T.navy,
    },
    verifyBtn: {
        paddingHorizontal: 16,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    verifyBtnDefault: {
        backgroundColor: T.navy,
    },
    verifyBtnSuccess: {
        backgroundColor: '#16a34a',
    },
    verifyBtnText: {
        color: T.white,
        fontWeight: '800',
        fontSize: 12,
    },
    verifyResultCard: {
        backgroundColor: '#f0fdf4',
        borderWidth: 1,
        borderColor: '#bbf7d0',
        borderRadius: 16,
        padding: 12,
        marginTop: 8,
    },
    verifyResultHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    verifyResultTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#166534',
    },
    verifyResultDivider: {
        height: 1,
        backgroundColor: '#dcfce7',
        marginVertical: 6,
    },
    verifyResultRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 2,
    },
    verifyResultLabel: {
        fontSize: 10.5,
        color: '#475569',
    },
    verifyResultValue: {
        fontSize: 10.5,
        fontWeight: '800',
        color: '#1e293b',
    },
    quantityContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    quantityControls: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: T.bg,
        borderRadius: 16,
        padding: 4,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    quantityBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: T.white,
        borderRadius: 12,
        shadowColor: T.text,
        shadowOpacity: 0.05,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
    },
    quantityText: {
        width: 48,
        textAlign: 'center',
        fontWeight: '900',
        color: T.navy,
        fontSize: 16,
    },
    discountTrackerContainer: {
        backgroundColor: T.white,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        borderRadius: 20,
        padding: 14,
        marginBottom: 24,
    },
    discountTrackerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    discountTrackerTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: T.text,
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
        color: T.textLight,
        textAlign: 'center',
    },
    amountLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    discountTag: {
        color: '#ef4444',
        fontWeight: '800',
        fontSize: 10,
        marginLeft: 8,
    },
    amountBox: {
        backgroundColor: T.bg,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
    },
    amountText: {
        fontWeight: '900',
        color: T.navy,
        fontSize: 16,
    },
    autoRenewBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 14,
        marginBottom: 16,
        backgroundColor: T.bg,
        borderColor: '#e2e8f0',
    },
    autoRenewBtnActive: {
        backgroundColor: '#fffbeb',
        borderColor: T.goldLight,
    },
    autoRenewText: {
        fontWeight: '800',
        color: T.text,
    },
    autoRenewTextActive: {
        color: T.navy,
    },
    autoRenewToggle: {
        width: 40,
        height: 24,
        borderRadius: 12,
        padding: 2,
        justifyContent: 'center',
        backgroundColor: '#cbd5e1',
        alignItems: 'flex-start',
    },
    autoRenewToggleActive: {
        backgroundColor: T.gold,
        alignItems: 'flex-end',
    },
    autoRenewToggleThumb: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: T.white,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
    },
    autoRenewInfoContainer: {
        flexDirection: 'row',
        backgroundColor: '#fffbeb',
        borderWidth: 1,
        borderColor: T.goldLight,
        borderRadius: 16,
        padding: 12,
        marginTop: -8,
        marginBottom: 24,
    },
    autoRenewInfoText: {
        flex: 1,
        fontSize: 10.5,
        color: T.navy,
        lineHeight: 14,
    },
    payBtn: {
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: T.gold,
        shadowColor: T.gold,
        shadowOpacity: 0.4,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
    },
    payBtnText: {
        color: T.navy,
        fontWeight: '900',
        fontSize: 16,
        letterSpacing: 2,
    },
    guideContainer: {
        backgroundColor: T.white,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        borderRadius: 24,
        marginTop: 16,
        overflow: 'hidden',
    },
    guideHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: T.bg,
    },
    guideHeaderTitle: {
        fontSize: 12.5,
        fontWeight: '800',
        color: T.navy,
    },
    guideContent: {
        padding: 16,
        backgroundColor: T.white,
        borderTopWidth: 1,
        borderColor: '#f1f5f9',
    },
    guideText: {
        fontSize: 10.5,
        color: T.textLight,
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
        color: T.navy,
    },
    guideItemDesc: {
        fontSize: 10.5,
        color: T.textLight,
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
        color: T.white,
    },
});
