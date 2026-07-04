import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, LayoutAnimation, Image, Dimensions, Animated, UIManager } from 'react-native';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../services/api';
import { supabase } from '../../services/supabase';
import SecurityModal from '../../components/SecurityModal';
import TransactionConfirmationModal from '../../components/TransactionConfirmationModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';

const { width: W } = Dimensions.get('window');

if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

export default function BillsScreen() {
    const [category, setCategory] = useState<'electricity' | 'tv'>('electricity');
    const [provider, setProvider] = useState('');
    const [customerId, setCustomerId] = useState(''); // Meter or SmartCard
    const [amount, setAmount] = useState('');
    
    // API State
    const [loading, setLoading] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [verifiedName, setVerifiedName] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [balance, setBalance] = useState<number | null>(null);
    const [providers, setProviders] = useState<any[]>([]);
    
    // TV Specific
    const [tvPackages, setTvPackages] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPackage, setSelectedPackage] = useState<any>(null);

    // Recent Beneficiaries
    const [recentMeters, setRecentMeters] = useState<any[]>([]);
    const [recentSmartCards, setRecentSmartCards] = useState<any[]>([]);

    // Modals
    const [showSecurityModal, setShowSecurityModal] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);

    // UI States
    const [idFocused, setIdFocused] = useState(false);
    const [amountFocused, setAmountFocused] = useState(false);
    const [searchFocused, setSearchFocused] = useState(false);
    const fadeAnim = useRef(new Animated.Value(1)).current;

    const router = useRouter();

    useEffect(() => {
        fetchBalance();
        loadProviders();
        loadRecents();
    }, [category]);

    const loadRecents = async () => {
        try {
            const metersStr = await AsyncStorage.getItem('@recent_meters');
            const cardsStr = await AsyncStorage.getItem('@recent_cards');
            if (metersStr) setRecentMeters(JSON.parse(metersStr));
            if (cardsStr) setRecentSmartCards(JSON.parse(cardsStr));
        } catch (e) { }
    };

    const saveRecent = async (name: string, id: string, prov: string) => {
        try {
            if (category === 'electricity') {
                const updated = [{ name, id, provider: prov }, ...recentMeters.filter(m => m.id !== id)].slice(0, 5);
                setRecentMeters(updated);
                await AsyncStorage.setItem('@recent_meters', JSON.stringify(updated));
            } else {
                const updated = [{ name, id, provider: prov }, ...recentSmartCards.filter(c => c.id !== id)].slice(0, 5);
                setRecentSmartCards(updated);
                await AsyncStorage.setItem('@recent_cards', JSON.stringify(updated));
            }
        } catch (e) { }
    };

    const switchCategory = (newCat: 'electricity' | 'tv') => {
        if (newCat === category) return;
        Animated.sequence([
            Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
        ]).start(() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setCategory(newCat);
            setProvider('');
            setCustomerId('');
            setAmount('');
            setVerifiedName(null);
            Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
        });
    };

    const loadProviders = async () => {
        if (category === 'electricity') {
            const data = await api.electricity.getProviders();
            setProviders(data);
        } else {
            const data = await api.tv.getProviders();
            setProviders(data);
        }
    };

    const fetchBalance = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user.id).single();
            if (profile) setBalance(profile.balance);
        }
    };

    // When provider changes, fetch packages if TV
    useEffect(() => {
        setVerifiedName(null);
        setErrorMsg(null);
        setCustomerId('');
        setAmount('');
        setSelectedPackage(null);
        setSearchQuery('');

        if (category === 'tv' && provider) {
            loadTvPackages(provider);
        }
    }, [provider, category]);

    const loadTvPackages = async (prov: string) => {
        setLoading(true);
        try {
            const pkgs = await api.tv.getPackages(prov);
            setTvPackages(pkgs);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const verifyCustomer = async (forcedId?: string, forcedProv?: string) => {
        const currentId = forcedId || customerId;
        const currentProv = forcedProv || provider;
        if (!currentId || !currentProv) return;
        setVerifying(true);
        try {
            let res;
            if (category === 'electricity') {
                res = await api.electricity.verifyMeter(currentId, currentProv);
            } else {
                res = await api.tv.verifySmartCard(currentId, currentProv);
            }

            if (res.isValid) {
                setVerifiedName(res.customerName || null);
                setErrorMsg(null);
                saveRecent(res.customerName || currentId, currentId, currentProv);
            } else {
                setErrorMsg(res.message || "Verification Failed");
                setVerifiedName(null);
            }
        } catch (e: any) {
            setErrorMsg(e.message || "Failed to verify ID");
            setVerifiedName(null);
        }
        setVerifying(false);
    };

    const handleRecentSelect = (recent: any) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setProvider(recent.provider);
        setCustomerId(recent.id);
        setVerifiedName(recent.name);
        setErrorMsg(null);
    };

    const handleContinue = () => {
        if (!provider || !customerId) {
            Alert.alert("Error", "Please fill all required fields");
            return;
        }

        const numAmount = Number(amount);
        if (category === 'electricity') {
            if (numAmount < 500) {
                Alert.alert("Error", "Minimum electricity purchase is ₦500");
                return;
            }
        } else {
            if (!selectedPackage) {
                Alert.alert("Error", "Please select a TV Package");
                return;
            }
        }

        if (balance !== null && numAmount > balance) {
            Alert.alert(
                "Insufficient Funds",
                "Your wallet balance is lower than the required amount.",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Fund Wallet", onPress: () => router.push('/(app)/wallet') }
                ]
            );
            return;
        }

        // Must verify first
        if (!verifiedName) {
            Alert.alert(
                "Verify Number",
                "Please verify the number before proceeding.",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Verify Now", onPress: () => verifyCustomer() }
                ]
            );
            return;
        }

        setShowConfirmation(true);
    };

    const processPayment = async (pin?: string) => {
        setShowSecurityModal(false);
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            let result;
            if (category === 'electricity') {
                result = await api.electricity.purchase(user.id, {
                    provider,
                    meterNumber: customerId,
                    amount: Number(amount),
                    meterType: 'prepaid' // Assuming prepaid for now
                });
            } else {
                result = await api.tv.purchase(user.id, {
                    provider,
                    smartCard: customerId,
                    packageId: selectedPackage.id,
                    amount: Number(amount),
                    packageName: selectedPackage.name
                });
            }

            if (result.success) {
                if (category === 'electricity' && (result as any).token) {
                    Alert.alert("Success", `Payment Successful!\n\nToken: ${(result as any).token}`);
                } else {
                    Alert.alert("Success", "Payment processed successfully!");
                }
                router.back();
            }
        } catch (e: any) {
            Alert.alert("Transaction Failed", e.message || "Something went wrong");
        }
        setLoading(false);
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: '#f4f6fb' }}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            {/* Premium Header */}
            <LinearGradient colors={['#060d21', '#0d1b3e']} style={s.headerContainer}>
                <View style={s.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
                        <Ionicons name="arrow-back" size={20} color="white" />
                    </TouchableOpacity>
                    <View style={{ alignItems: 'center' }}>
                        <Text style={s.headerTitle}>Pay Bills</Text>
                        <Text style={s.headerBalance}>Balance: ₦{balance?.toLocaleString() || '0.00'}</Text>
                    </View>
                    <View style={{ width: 32 }} />
                </View>

            {/* Category Switcher with Glassmorphism */}
                <View style={[s.tabContainer, { borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }]}>
                    <TouchableOpacity
                        onPress={() => switchCategory('electricity')}
                        style={[s.tabItem, category === 'electricity' && { backgroundColor: 'rgba(255,255,255,0.2)' }]}
                    >
                        <Ionicons name="flash" size={16} color={category === 'electricity' ? 'white' : 'rgba(255,255,255,0.5)'} style={{ marginRight: 6 }} />
                        <Text style={[s.tabText, category === 'electricity' && s.tabTextActive]}>Electricity</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => switchCategory('tv')}
                        style={[s.tabItem, category === 'tv' && { backgroundColor: 'rgba(255,255,255,0.2)' }]}
                    >
                        <Ionicons name="tv" size={16} color={category === 'tv' ? 'white' : 'rgba(255,255,255,0.5)'} style={{ marginRight: 6 }} />
                        <Text style={[s.tabText, category === 'tv' && s.tabTextActive]}>Cable TV</Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <Animated.ScrollView 
                contentContainerStyle={s.scrollContent} 
                showsVerticalScrollIndicator={false} 
                style={{ opacity: fadeAnim }}
                keyboardShouldPersistTaps="always"
                keyboardDismissMode="none"
            >
                
                {/* Recent Beneficiaries Slider */}
                {(category === 'electricity' ? recentMeters : recentSmartCards).length > 0 && (
                    <View style={{ marginBottom: 24 }}>
                        <Text style={s.sectionTitle}>Recent Saved {category === 'electricity' ? 'Meters' : 'SmartCards'}</Text>
                        <ScrollView 
                            horizontal 
                            showsHorizontalScrollIndicator={false} 
                            contentContainerStyle={{ gap: 12 }}
                            keyboardShouldPersistTaps="always"
                        >
                            {(category === 'electricity' ? recentMeters : recentSmartCards).map((r, idx) => (
                                <TouchableOpacity key={idx} style={s.recentCard} onPress={() => handleRecentSelect(r)}>
                                    <View style={s.recentIcon}>
                                        <Ionicons name={category === 'electricity' ? 'flash' : 'tv'} size={14} color="#0056D2" />
                                    </View>
                                    <View>
                                        <Text style={s.recentName} numberOfLines={1}>{r.name}</Text>
                                        <Text style={s.recentId}>{r.id}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* Providers Grid */}
                <Text style={s.sectionTitle}>Select Provider</Text>
                <View style={s.providersGrid}>
                    {providers.map((p) => {
                        const isSelected = provider === p.id;
                        return (
                            <TouchableOpacity
                                key={p.id}
                                style={[s.providerCard, isSelected && s.providerCardSelected]}
                                onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setProvider(p.id); }}
                            >
                                <View style={[s.providerIconWrapper, isSelected && { backgroundColor: '#0056D2' }]}>
                                    {p.logo ? (
                                        <Image source={typeof p.logo === 'string' && p.logo.startsWith('http') ? { uri: p.logo } : p.logo} style={{ width: 36, height: 36, borderRadius: 18, resizeMode: 'contain' }} />
                                    ) : (
                                        <Ionicons name={category === 'electricity' ? 'flash' : 'tv'} size={18} color={isSelected ? 'white' : '#0d1b3e'} />
                                    )}
                                </View>
                                <Text style={[s.providerName, isSelected && { color: '#0056D2', fontWeight: '800' }]} numberOfLines={1}>{p.name}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {provider ? (
                    <View style={s.formContainer}>
                        {/* ID Input */}
                        <Text style={s.inputLabel}>{category === 'electricity' ? 'Meter Number' : 'IUC / SmartCard Number'}</Text>
                        <View style={[s.inputWrapper, idFocused && s.inputWrapperFocused]}>
                            <Ionicons name="finger-print-outline" size={20} color={idFocused ? '#0056D2' : '#94A3B8'} style={{ marginRight: 10 }} />
                            <TextInput
                                style={s.input}
                                keyboardType="number-pad"
                                placeholder={category === 'electricity' ? "e.g. 45012345678" : "e.g. 7012345678"}
                                value={customerId}
                                onChangeText={(t) => { setCustomerId(t); setVerifiedName(null); setErrorMsg(null); }}
                                onFocus={() => setIdFocused(true)}
                                onBlur={() => setIdFocused(false)}
                            />
                            {customerId.length > 5 && !verifiedName && (
                                <TouchableOpacity onPress={() => verifyCustomer()} disabled={verifying} style={s.verifyBtn}>
                                    {verifying ? <ActivityIndicator size="small" color="white" /> : <Text style={s.verifyBtnText}>Verify</Text>}
                                </TouchableOpacity>
                            )}
                            {verifiedName && (
                                <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                            )}
                        </View>

                        {/* Verified Name Display */}
                        {verifiedName && (
                            <View style={s.verifiedCard}>
                                <Ionicons name="person-circle" size={20} color="#0056D2" style={{ marginRight: 8 }} />
                                <Text style={s.verifiedText}>{verifiedName}</Text>
                            </View>
                        )}
                        {/* Error Message Display */}
                        {errorMsg && (
                            <View style={s.errorCard}>
                                <Ionicons name="warning" size={16} color="#EF4444" style={{ marginRight: 8 }} />
                                <Text style={s.errorText}>{errorMsg}</Text>
                            </View>
                        )}

                        {/* Amount or Packages */}
                        {category === 'electricity' ? (
                            <>
                                <Text style={s.inputLabel}>Amount (₦)</Text>
                                <View style={[s.inputWrapper, amountFocused && s.inputWrapperFocused]}>
                                    <Text style={s.currencyPrefix}>₦</Text>
                                    <TextInput
                                        style={s.inputLarge}
                                        keyboardType="number-pad"
                                        placeholder="0.00"
                                        value={amount}
                                        onChangeText={setAmount}
                                        onFocus={() => setAmountFocused(true)}
                                        onBlur={() => setAmountFocused(false)}
                                    />
                                </View>
                            </>
                        ) : (
                            <>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
                                    <Text style={[s.inputLabel, { marginBottom: 0 }]}>Select Package</Text>
                                </View>
                                
                                <View style={[s.inputWrapper, searchFocused && s.inputWrapperFocused, { height: 48, borderRadius: 12, marginBottom: 16 }]}>
                                    <Ionicons name="search" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
                                    <TextInput
                                        style={[s.input, { fontSize: 14 }]}
                                        placeholder="Search package..."
                                        value={searchQuery}
                                        onChangeText={setSearchQuery}
                                        onFocus={() => setSearchFocused(true)}
                                        onBlur={() => setSearchFocused(false)}
                                    />
                                </View>

                                {loading && !tvPackages.length ? (
                                    <ActivityIndicator size="large" color="#0056D2" style={{ marginVertical: 20 }} />
                                ) : (
                                    <View style={s.packagesList}>
                                        {tvPackages.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).map(pkg => (
                                            <TouchableOpacity 
                                                key={pkg.id} 
                                                style={[s.packageCard, selectedPackage?.id === pkg.id && s.packageCardSelected]}
                                                onPress={() => {
                                                    setSelectedPackage(pkg);
                                                    setAmount(pkg.price.toString());
                                                }}
                                            >
                                                <View style={s.packageInfo}>
                                                    <Text style={[s.packageName, selectedPackage?.id === pkg.id && { color: 'white' }]}>{pkg.name}</Text>
                                                    <Text style={[s.packagePrice, selectedPackage?.id === pkg.id && { color: 'rgba(255,255,255,0.9)' }]}>
                                                        ₦{pkg.price.toLocaleString()}
                                                    </Text>
                                                </View>
                                                <View style={[s.radioCircle, selectedPackage?.id === pkg.id && s.radioCircleSelected]}>
                                                    {selectedPackage?.id === pkg.id && <View style={s.radioInner} />}
                                                </View>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </>
                        )}
                    </View>
                ) : null}
            </Animated.ScrollView>

            {/* Bottom Action Area */}
            {provider && (
                <View style={s.bottomContainer}>
                    <BlurView intensity={80} tint="light" style={s.bottomBlur}>
                        <TouchableOpacity 
                            style={[s.continueBtn, (!customerId || !amount) && s.continueBtnDisabled]}
                            onPress={handleContinue}
                            disabled={!customerId || !amount || loading}
                        >
                            {loading ? <ActivityIndicator size="small" color="white" /> : (
                                <LinearGradient
                                    colors={(!customerId || !amount) ? ['#cbd5e1', '#cbd5e1'] : ['#0056D2', '#003F9A']}
                                    style={s.continueBtnGradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                >
                                    <Ionicons name="shield-checkmark" size={16} color="white" style={{ marginRight: 6 }} />
                                    <Text style={s.continueBtnText}>Pay Now</Text>
                                </LinearGradient>
                            )}
                        </TouchableOpacity>
                    </BlurView>
                </View>
            )}

            {/* Modals */}
            <TransactionConfirmationModal
                visible={showConfirmation}
                title={category === 'electricity' ? "Electricity Token" : "Cable TV Subscription"}
                details={[
                    { label: "Provider", value: provider.toUpperCase() },
                    { label: "Account ID", value: verifiedName ? `${verifiedName} (${customerId})` : customerId },
                    { label: "Amount", value: `₦${Number(amount).toLocaleString()}`, isAmount: true },
                    { label: "Fee", value: "₦0.00" },
                    { label: "Total Payable", value: `₦${Number(amount).toLocaleString()}`, isTotal: true }
                ]}
                onConfirm={() => {
                    setShowConfirmation(false);
                    setTimeout(() => setShowSecurityModal(true), 500);
                }}
                onClose={() => setShowConfirmation(false)}
            />

            <SecurityModal
                visible={showSecurityModal}
                onSuccess={processPayment}
                onClose={() => setShowSecurityModal(false)}
                title="Confirm Payment"
                description="Enter your 4-digit PIN to authorize this bill payment"
            />
        </KeyboardAvoidingView>
    );
}

const s = StyleSheet.create({
    headerContainer: {
        paddingHorizontal: 20,
        paddingTop: 56,
        paddingBottom: 24,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        zIndex: 20,
        shadowColor: '#0056D2',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: 'white',
        letterSpacing: -0.3,
    },
    headerBalance: {
        fontSize: 12,
        fontWeight: '700',
        color: '#f5a623',
        marginTop: 4,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: 4,
    },
    tabItem: {
        flex: 1,
        flexDirection: 'row',
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
    },
    tabItemActive: {
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    tabText: {
        fontSize: 13,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.5)',
    },
    tabTextActive: {
        color: 'white',
        fontWeight: '900',
    },
    scrollContent: {
        padding: 24,
        paddingBottom: 250, // Much larger padding to clear bottom button and tab bar
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0d1b3e',
        marginBottom: 16,
        marginLeft: 4,
    },
    recentCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        padding: 12,
        paddingRight: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
        width: 200,
    },
    recentIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f0f9ff',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    recentName: {
        fontSize: 13,
        fontWeight: '800',
        color: '#334155',
        marginBottom: 2,
    },
    recentId: {
        fontSize: 11,
        fontWeight: '600',
        color: '#94a3b8',
    },
    providersGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        gap: 8,
        marginBottom: 24,
    },
    providerCard: {
        width: (W - 48 - 32) / 5, // (W - padding(24*2) - gaps(8*4)) / 5
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 8,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#f1f5f9',
        shadowColor: '#0d1b3e',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    providerCardSelected: {
        borderColor: '#0056D2',
        backgroundColor: '#f8fafc',
    },
    providerIconWrapper: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    providerName: {
        fontSize: 9,
        fontWeight: '700',
        color: '#64748B',
        textAlign: 'center',
    },
    formContainer: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 12,
        shadowColor: '#0d1b3e',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.05,
        shadowRadius: 16,
        elevation: 4,
        borderWidth: 1,
        borderColor: 'rgba(226,232,240,0.5)',
    },
    inputLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: '#334155',
        marginBottom: 6,
        marginLeft: 4,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 44,
        marginBottom: 12,
    },
    inputWrapperFocused: {
        borderColor: '#0056D2',
        backgroundColor: 'white',
    },
    input: {
        flex: 1,
        fontSize: 14,
        fontWeight: '700',
        color: '#0d1b3e',
    },
    verifyBtn: {
        backgroundColor: '#0056D2',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        marginLeft: 8,
    },
    verifyBtnText: {
        color: 'white',
        fontSize: 11,
        fontWeight: '800',
    },
    verifiedCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ecfdf5',
        padding: 12,
        borderRadius: 12,
        marginBottom: 20,
        marginTop: -8,
        borderWidth: 1,
        borderColor: '#a7f3d0',
    },
    verifiedText: {
        fontSize: 14,
        color: '#0056D2',
        fontWeight: '600',
        flex: 1,
    },
    errorCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF2F2',
        padding: 12,
        borderRadius: 12,
        marginTop: -8,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    errorText: {
        fontSize: 13,
        color: '#EF4444',
        fontWeight: '500',
        flex: 1,
    },
    currencyPrefix: {
        fontSize: 18,
        fontWeight: '900',
        color: '#94A3B8',
        marginRight: 8,
    },
    inputLarge: {
        flex: 1,
        fontSize: 20,
        fontWeight: '900',
        color: '#0d1b3e',
    },
    packagesList: {
        gap: 12,
    },
    packageCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 16,
        backgroundColor: '#f8fafc',
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
    },
    packageCardSelected: {
        backgroundColor: '#0056D2',
        borderColor: '#0056D2',
    },
    packageInfo: {
        flex: 1,
    },
    packageName: {
        fontSize: 15,
        fontWeight: '800',
        color: '#334155',
        marginBottom: 4,
    },
    packagePrice: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748B',
    },
    radioCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#cbd5e1',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'white',
    },
    radioCircleSelected: {
        borderColor: 'white',
    },
    radioInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#0056D2',
    },
    bottomContainer: {
        position: 'absolute',
        bottom: 95, // Raised further to completely clear the tab bar
        left: 20,
        right: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bottomBlur: {
        width: '100%', // Stretch across the container
        borderRadius: 20, 
        paddingHorizontal: 6,
        paddingVertical: 6,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.4)',
        shadowColor: '#0056D2',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
    },
    continueBtn: {
        width: '100%', // Fill the blur view
        height: 44, // Match amount input height roughly
        borderRadius: 16, 
        shadowColor: '#0056D2',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 6,
    },
    continueBtnGradient: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16, // Match the button border radius
    },
    continueBtnDisabled: {
        shadowOpacity: 0,
        elevation: 0,
    },
    continueBtnText: {
        color: 'white',
        fontSize: 12, // Smaller font
        fontWeight: '800',
    }
});
