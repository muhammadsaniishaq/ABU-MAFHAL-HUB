import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Image, Dimensions, Switch, LayoutAnimation } from 'react-native';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useAppSettings } from '../../hooks/useAppSettings';
import DynamicBanners from '../../components/DynamicBanners';
import { api } from '../../services/api';
import { supabase } from '../../services/supabase';
import SecurityModal from '../../components/SecurityModal';
import TransactionConfirmationModal from '../../components/TransactionConfirmationModal';

const { width: W } = Dimensions.get('window');

export default function SmileScreen() {
    const [accountId, setAccountId] = useState('');
    const [packages, setPackages] = useState<any[]>([]);
    const [selectedPackage, setSelectedPackage] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [verifiedName, setVerifiedName] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [balance, setBalance] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [showSecurityModal, setShowSecurityModal] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [idFocused, setIdFocused] = useState(false);
    const [recentAccounts, setRecentAccounts] = useState<string[]>([]);
    
    // New Features States
    const [autoRenew, setAutoRenew] = useState(false);
    const [saveBeneficiary, setSaveBeneficiary] = useState(false);
    const [sendReceipt, setSendReceipt] = useState(false);
    const [promoCode, setPromoCode] = useState('');
    const [purchaseMode, setPurchaseMode] = useState<'self' | 'others'>('others');
    const [scheduleRecharge, setScheduleRecharge] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const router = useRouter();

    useEffect(() => {
        fetchBalance();
        loadPackages();
        loadRecentAccounts();
    }, []);

    const loadRecentAccounts = async () => {
        try {
            const saved = await AsyncStorage.getItem('recent_smile_accounts');
            if (saved) {
                setRecentAccounts(JSON.parse(saved));
            }
        } catch (e) {
            console.error("Failed to load recent smile accounts", e);
        }
    };

    const saveRecentAccount = async (acc: string) => {
        try {
            let updated = [acc, ...recentAccounts.filter(a => a !== acc)].slice(0, 5);
            setRecentAccounts(updated);
            await AsyncStorage.setItem('recent_smile_accounts', JSON.stringify(updated));
        } catch (e) {
            console.error(e);
        }
    };

    const fetchBalance = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user.id).single();
            if (profile) setBalance(profile.balance);
        }
    };

    const loadPackages = async () => {
        setLoading(true);
        try {
            const pkgs = await api.smile.getPackages();
            setPackages(pkgs);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (accountId.length >= 5) {
            const timeoutId = setTimeout(() => {
                verifyCustomer(accountId);
            }, 800);
            return () => clearTimeout(timeoutId);
        }
    }, [accountId]);

    const verifyCustomer = async (idToVerify: string = accountId) => {
        if (!idToVerify || idToVerify.length < 5) return;
        setVerifying(true);
        setErrorMsg(null);

        // Basic client-side validation for Smile numbers
        if (idToVerify.length === 11 && !idToVerify.startsWith('0702')) {
            setErrorMsg("This does not look like a Smile phone number (should start with 0702). Please verify.");
            setVerifiedName(null);
            setVerifying(false);
            return;
        }

        try {
            const res = await api.smile.verifyAccount(idToVerify);
            if (res.isValid && res.customerName) {
                setVerifiedName(res.customerName);
            } else {
                setVerifiedName(null);
                setErrorMsg(res.message || "Invalid Smile Account Number");
            }
        } catch (e: any) {
            setErrorMsg(e.message || "Verification Failed");
        }
        setVerifying(false);
    };

    const handleProcess = () => {
        if (!accountId) {
            Alert.alert("Error", "Please enter your Smile Account Number");
            return;
        }
        if (!verifiedName) {
            Alert.alert("Verify First", "Please wait for account verification");
            return;
        }
        if (!selectedPackage) {
            Alert.alert("Error", "Please select a data plan");
            return;
        }
        if (balance !== null && balance < selectedPackage.price) {
            Alert.alert("Insufficient Balance", `You need ₦${selectedPackage.price.toLocaleString()} for this plan.`);
            return;
        }
        setShowConfirmation(true);
    };

    const confirmPayment = () => {
        setShowConfirmation(false);
        setTimeout(() => {
            setShowSecurityModal(true);
        }, 500);
    };

    const executePayment = async () => {
        setShowSecurityModal(false);
        saveRecentAccount(accountId);
        setIsSubmitting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            const result = await api.smile.purchase({
                accountId,
                planId: selectedPackage.id,
                amount: selectedPackage.price
            });

            if (result.success) {
                router.replace({
                    pathname: '/success',
                    params: {
                        amount: `₦${selectedPackage.price.toLocaleString()}`,
                        type: 'Smile Subscription',
                        reference: result.reference || 'SMILE-' + Date.now()
                    }
                });
            }
        } catch (e: any) {
            Alert.alert("Transaction Failed", e.message || "An error occurred");
        } finally {
            setIsSubmitting(false);
        }
    };    return (
        <View style={s.container}>
            <StatusBar style="dark" />

            
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />
            
            {/* Premium Curved Header matching Data page */}
            <LinearGradient 
                colors={['#060d21', '#0d1b3e']} 
                style={s.headerContainer}
            >
                <View style={s.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
                        <Ionicons name="arrow-back" size={20} color="#ffffff" />
                    </TouchableOpacity>
                    <View style={{ alignItems: 'center' }}>
                        <Text style={s.headerTitle}>Smile Internet</Text>
                        <View style={s.smileIndicator}>
                            <Ionicons name="happy" size={12} color="#8cc63f" style={{ marginRight: 4 }} />
                            <Text style={s.smileIndicatorText}>Powered by Smile</Text>
                        </View>
                    </View>
                    <View style={{ width: 38 }} />
                </View>
            </LinearGradient>

            <View style={{ height: 20 }} />
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    {/* Dynamic Banners */}
                    <DynamicBanners placement="smile" />

                    <LinearGradient
                        colors={['#0d1b3e', '#142258']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={s.balanceCard}
                    >
                        <View>
                            <Text style={s.balanceLabel}>Available Balance</Text>
                            <Text style={s.balanceValue}>
                                ₦{balance !== null ? balance.toLocaleString() : '---'}
                            </Text>
                        </View>
                        <View style={s.walletIconBox}>
                            <Ionicons name="wallet" size={24} color="#f5a623" />
                        </View>
                    </LinearGradient>
                    
                    {/* New Feature: Purchase Mode Toggle */}
                    <View style={s.purchaseModeRow}>
                        <TouchableOpacity 
                            style={[s.modeTab, purchaseMode === 'self' && s.modeTabActive]}
                            onPress={() => {
                                setPurchaseMode('self');
                                // Could auto-fill account ID if available for self
                            }}
                        >
                            <Ionicons name="person-outline" size={14} color={purchaseMode === 'self' ? '#ffffff' : '#64748b'} />
                            <Text style={[s.modeTabText, purchaseMode === 'self' && s.modeTabTextActive]}>For Me</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[s.modeTab, purchaseMode === 'others' && s.modeTabActive]}
                            onPress={() => setPurchaseMode('others')}
                        >
                            <Ionicons name="people-outline" size={14} color={purchaseMode === 'others' ? '#ffffff' : '#64748b'} />
                            <Text style={[s.modeTabText, purchaseMode === 'others' && s.modeTabTextActive]}>For Others</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Account ID Input */}
                    <View style={s.sectionHeader}>
                        <Ionicons name="person-outline" size={14} color="#0d1b3e" style={{ marginRight: 6 }} />
                        <Text style={s.sectionTitle}>Smile Account Number</Text>
                    </View>
                    <View style={[s.inputBoxContainer, idFocused && s.inputBoxFocused]}>
                        <Ionicons name="call-outline" size={18} color={idFocused ? '#f5a623' : '#94a3b8'} style={{ marginRight: 12 }} />
                        <TextInput
                            style={s.textInput}
                            placeholder="e.g. 1234567890"
                            placeholderTextColor="#94a3b8"
                            keyboardType="number-pad"
                            maxLength={11}
                            value={accountId}
                            onFocus={() => setIdFocused(true)}
                            onBlur={() => {
                                setIdFocused(false);
                                verifyCustomer();
                            }}
                            onChangeText={(text) => {
                                setAccountId(text);
                                setVerifiedName(null);
                                setErrorMsg(null);
                            }}
                        />
                        {verifying && <ActivityIndicator size="small" color="#f5a623" />}
                    </View>

                    {/* Live Recent Accounts */}
                    {!accountId && !verifiedName && recentAccounts.length > 0 && (
                        <View style={s.recentAccountsContainer}>
                            <Text style={s.recentAccountsLabel}>Recent Accounts</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.recentAccountsList}>
                                {recentAccounts.map((acc, idx) => (
                                    <TouchableOpacity 
                                        key={idx} 
                                        style={s.recentAccountPill}
                                        onPress={() => setAccountId(acc)}
                                    >
                                        <Ionicons name="time-outline" size={14} color="#f5a623" />
                                        <Text style={s.recentAccountTxt}>{acc}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {/* Verification Result */}
                    {verifiedName && (
                        <View style={s.successBox}>
                            <Ionicons name="checkmark-circle" size={20} color="#059669" />
                            <Text style={s.successTxt}>{verifiedName}</Text>
                        </View>
                    )}
                    {errorMsg && (
                        <View style={s.errorBox}>
                            <Ionicons name="alert-circle" size={20} color="#dc2626" />
                            <Text style={s.errorTxt}>{errorMsg}</Text>
                        </View>
                    )}

                    {/* New Feature: Save Beneficiary Toggle */}
                    {verifiedName && (
                        <View style={s.featureRow}>
                            <View style={s.featureIconBox}>
                                <Ionicons name="bookmark" size={14} color="#f5a623" />
                            </View>
                            <View style={s.featureTextCol}>
                                <Text style={s.featureTitle}>Save as Beneficiary</Text>
                                <Text style={s.featureSub}>Save this account for future recharges</Text>
                            </View>
                            <Switch 
                                value={saveBeneficiary}
                                onValueChange={setSaveBeneficiary}
                                trackColor={{ false: '#e2e8f0', true: '#f5a623' }}
                                thumbColor={'#ffffff'}
                                style={{ transform: [{ scale: 0.8 }] }}
                            />
                        </View>
                    )}

                    {/* Packages List */}
                    <View style={[s.sectionHeader, { marginTop: 15 }]}>
                        <Ionicons name="list-outline" size={14} color="#0d1b3e" style={{ marginRight: 6 }} />
                        <Text style={s.sectionTitle}>Select Data Bundle</Text>
                    </View>
                    {loading ? (
                        <View style={s.loadingBox}>
                            <ActivityIndicator size="large" color="#0d1b3e" />
                            <Text style={s.loadingTxt}>Loading Smile Packages...</Text>
                        </View>
                    ) : (
                        <View style={s.packagesList}>
                            {packages.map((pkg) => {
                                const isSelected = selectedPackage?.id === pkg.id;
                                return (
                                    <TouchableOpacity
                                        key={pkg.id}
                                        style={[s.planListCard, isSelected && s.planListCardSelected]}
                                        onPress={() => setSelectedPackage(pkg)}
                                        activeOpacity={0.8}
                                    >
                                        {isSelected ? (
                                            <LinearGradient
                                                colors={['#0d1b3e', '#142258']}
                                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                                style={s.planListCardGradient}
                                            >
                                                <View style={[s.planVolumeBadge, s.planVolumeBadgeSelected]}>
                                                    <Ionicons name="flash" size={24} color="#f5a623" />
                                                </View>
                                                <View style={s.planDetailsMid}>
                                                    <Text style={[s.planListName, s.planListNameSelected]}>{pkg.name}</Text>
                                                    <Text style={[s.planListValidity, s.planListValiditySelected]}>Smile Network</Text>
                                                </View>
                                                <View style={s.planRightSide}>
                                                    <Text style={[s.planListPrice, s.planListPriceSelected]}>₦{pkg.price.toLocaleString()}</Text>
                                                    <Ionicons name="checkmark-circle" size={18} color="#f5a623" style={{ marginTop: 2 }} />
                                                </View>
                                            </LinearGradient>
                                        ) : (
                                            <View style={s.planListCardGradient}>
                                                <View style={s.planVolumeBadge}>
                                                    <Ionicons name="flash-outline" size={24} color="#64748b" />
                                                </View>
                                                <View style={s.planDetailsMid}>
                                                    <Text style={s.planListName}>{pkg.name}</Text>
                                                    <Text style={s.planListValidity}>Smile Network</Text>
                                                </View>
                                                <View style={s.planRightSide}>
                                                    <Text style={s.planListPrice}>₦{pkg.price.toLocaleString()}</Text>
                                                    <Ionicons name="chevron-forward" size={14} color="#cbd5e1" style={{ marginTop: 2 }} />
                                                </View>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}

                    {/* New Feature: Advanced Options Toggle */}
                    {selectedPackage && (
                        <TouchableOpacity 
                            style={s.advancedToggleBtn}
                            onPress={() => {
                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                setShowAdvanced(!showAdvanced);
                            }}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="options-outline" size={16} color="#0d1b3e" style={{ marginRight: 6 }} />
                            <Text style={s.advancedToggleTxt}>Advanced Options</Text>
                            <Ionicons name={showAdvanced ? "chevron-up" : "chevron-down"} size={16} color="#64748b" style={{ marginLeft: 'auto' }} />
                        </TouchableOpacity>
                    )}

                    {selectedPackage && showAdvanced && (
                        <View style={s.advancedContainer}>
                            {/* New Feature: Auto-Renew Toggle */}
                            <View style={[s.featureRow, { marginTop: 0 }]}>
                                <View style={s.featureIconBox}>
                                    <Ionicons name="sync-circle" size={14} color="#0d1b3e" />
                                </View>
                                <View style={s.featureTextCol}>
                                    <Text style={s.featureTitle}>Auto-Renew Plan</Text>
                                    <Text style={s.featureSub}>Automatically recharge when data expires</Text>
                                </View>
                                <Switch 
                                    value={autoRenew}
                                    onValueChange={setAutoRenew}
                                    trackColor={{ false: '#e2e8f0', true: '#0d1b3e' }}
                                    thumbColor={'#ffffff'}
                                    style={{ transform: [{ scale: 0.7 }] }}
                                />
                            </View>

                            {/* New Feature: Email Receipt Toggle */}
                            <View style={[s.featureRow, { marginTop: 12 }]}>
                                <View style={s.featureIconBox}>
                                    <Ionicons name="mail-outline" size={14} color="#0d1b3e" />
                                </View>
                                <View style={s.featureTextCol}>
                                    <Text style={s.featureTitle}>Email Receipt</Text>
                                    <Text style={s.featureSub}>Get a copy of the transaction receipt</Text>
                                </View>
                                <Switch 
                                    value={sendReceipt}
                                    onValueChange={setSendReceipt}
                                    trackColor={{ false: '#e2e8f0', true: '#0d1b3e' }}
                                    thumbColor={'#ffffff'}
                                    style={{ transform: [{ scale: 0.7 }] }}
                                />
                            </View>

                            {/* New Feature: Schedule Recharge */}
                            <View style={[s.featureRow, { marginTop: 12 }]}>
                                <View style={s.featureIconBox}>
                                    <Ionicons name="calendar-outline" size={14} color="#0d1b3e" />
                                </View>
                                <View style={s.featureTextCol}>
                                    <Text style={s.featureTitle}>Schedule Recharge</Text>
                                    <Text style={s.featureSub}>Buy now, activate automatically later</Text>
                                </View>
                                <Switch 
                                    value={scheduleRecharge}
                                    onValueChange={setScheduleRecharge}
                                    trackColor={{ false: '#e2e8f0', true: '#0d1b3e' }}
                                    thumbColor={'#ffffff'}
                                    style={{ transform: [{ scale: 0.7 }] }}
                                />
                            </View>

                            {/* Promo Code Field */}
                            <View style={{ marginTop: 16 }}>
                                <Text style={s.sectionTitle}>Promo Code (Optional)</Text>
                                <View style={[s.inputBoxContainer, { marginTop: 6 }]}>
                                    <Ionicons name="gift-outline" size={18} color="#94a3b8" style={{ marginRight: 12 }} />
                                    <TextInput
                                        style={s.textInput}
                                        placeholder="Enter discount code"
                                        placeholderTextColor="#94a3b8"
                                        value={promoCode}
                                        onChangeText={setPromoCode}
                                        autoCapitalize="characters"
                                    />
                                </View>
                            </View>
                        </View>
                    )}
                    
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Pay Bottom Bar */}
            <View style={s.bottomBar}>
                <View style={s.bottomBarContent}>
                    <View>
                        <Text style={s.totalLabel}>Total Payment</Text>
                        <Text style={s.totalAmount}>₦{selectedPackage ? selectedPackage.price.toLocaleString() : '0'}</Text>
                    </View>
                    <TouchableOpacity
                        style={[s.payBtn, (!accountId || !selectedPackage || !verifiedName || isSubmitting) && s.payBtnDisabled]}
                        disabled={!accountId || !selectedPackage || !verifiedName || isSubmitting}
                        onPress={handleProcess}
                    >
                        <LinearGradient
                            colors={(!accountId || !selectedPackage || !verifiedName || isSubmitting) ? ['#cbd5e1', '#94a3b8'] : ['#f5a623', '#d4890e']}
                            style={s.payBtnGradient}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        >
                            <Text style={s.payBtnTxt}>PROCESS</Text>
                            <Ionicons name="arrow-forward" size={16} color="#0d1b3e" />
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Modals */}
            <TransactionConfirmationModal
                visible={showConfirmation}
                onClose={() => setShowConfirmation(false)}
                onConfirm={confirmPayment}
                details={[
                    { label: 'Service', value: 'Smile Databundle' },
                    { label: 'Account No', value: accountId },
                    { label: 'Name', value: verifiedName || '' },
                    { label: 'Plan', value: selectedPackage?.name || '' },
                    { label: 'Amount', value: `₦${selectedPackage?.price.toLocaleString() || '0'}` }
                ]}
            />

            <SecurityModal
                visible={showSecurityModal}
                onClose={() => setShowSecurityModal(false)}
                onSuccess={executePayment}
            />
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f4f6fb' }, 
    
    headerContainer: {
        paddingTop: Platform.OS === 'ios' ? 50 : 35,
        paddingBottom: 16,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        shadowColor: '#0a1633',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
        zIndex: 10,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
    },
    backBtn: {
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#ffffff',
        letterSpacing: 0.5,
    },
    smileIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
    },
    smileIndicatorText: {
        fontSize: 9,
        fontWeight: '700',
        color: '#e2e8f0',
    },

    balanceCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, marginBottom: 12, borderRadius: 16, overflow: 'hidden', shadowColor: '#0a1633', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8 },
    balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 10.5, fontWeight: '700', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 },
    balanceValue: { color: '#ffffff', fontSize: 24, fontWeight: '900', letterSpacing: -1 },
    walletIconBox: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(245, 166, 35, 0.15)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(245, 166, 35, 0.3)' },

    scrollContent: { paddingHorizontal: 16, paddingBottom: 220 },
    
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        marginTop: 4,
    },
    sectionTitle: {
        fontSize: 10,
        fontWeight: '800',
        color: '#0d1b3e',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    
    inputBoxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 14,
        paddingHorizontal: 16,
        height: 48,
        marginBottom: 8,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        shadowColor: '#0a1633',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 2,
    },
    inputBoxFocused: {
        borderColor: '#f5a623',
        shadowColor: '#f5a623',
        shadowOpacity: 0.1,
    },
    textInput: {
        flex: 1,
        color: '#0d1b3e',
        fontSize: 14,
        fontWeight: '700',
    },
    
    // Purchase Mode Toggle
    purchaseModeRow: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 12, padding: 4, marginBottom: 16 },
    modeTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, gap: 6 },
    modeTabActive: { backgroundColor: '#0d1b3e', shadowColor: '#0a1633', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
    modeTabText: { color: '#64748b', fontSize: 13, fontWeight: '700' },
    modeTabTextActive: { color: '#ffffff' },

    recentAccountsContainer: { marginBottom: 12, marginTop: 4 },
    recentAccountsLabel: { color: '#64748b', fontSize: 10, fontWeight: '700', marginBottom: 6, marginLeft: 2, textTransform: 'uppercase' },
    recentAccountsList: { gap: 8, paddingRight: 16 },
    recentAccountPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#0a1633', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 5, elevation: 1 },
    recentAccountTxt: { color: '#0d1b3e', fontSize: 12, fontWeight: '700', marginLeft: 4 },

    successBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ecfdf5', padding: 12, borderRadius: 12, marginTop: 8, borderWidth: 1, borderColor: '#a7f3d0' },
    successTxt: { color: '#059669', fontWeight: '800', fontSize: 12, marginLeft: 8, flex: 1 },
    errorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef2f2', padding: 12, borderRadius: 12, marginTop: 8, borderWidth: 1, borderColor: '#fecaca' },
    errorTxt: { color: '#dc2626', fontWeight: '800', fontSize: 12, marginLeft: 8, flex: 1 },
    
    // Feature Row styles
    featureRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#f1f5f9', marginTop: 10 },
    featureIconBox: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#f4f6fb', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    featureTextCol: { flex: 1 },
    featureTitle: { fontSize: 12, fontWeight: '800', color: '#0d1b3e', marginBottom: 2 },
    featureSub: { fontSize: 10, color: '#64748b', fontWeight: '600' },
    
    advancedToggleBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', padding: 12, borderRadius: 12, marginTop: 15 },
    advancedToggleTxt: { fontSize: 12, fontWeight: '800', color: '#0d1b3e' },
    advancedContainer: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', marginTop: 10 },

    loadingBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 30 },
    loadingTxt: { color: '#64748b', fontWeight: '600', marginTop: 10, fontSize: 12 },

    packagesList: { marginTop: 5 },
    planListCard: {
        borderRadius: 14,
        backgroundColor: '#ffffff',
        marginBottom: 10,
        shadowColor: '#0a1633',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 2,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#f1f5f9'
    },
    planListCardSelected: {
        borderColor: '#f5a623',
        borderWidth: 1.5,
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 6,
    },
    planListCardGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
    },
    planVolumeBadge: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    planVolumeBadgeSelected: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderColor: 'rgba(255,255,255,0.2)',
    },
    planDetailsMid: { flex: 1, justifyContent: 'center', paddingRight: 8 },
    planListName: { fontSize: 12, fontWeight: '800', color: '#0d1b3e', marginBottom: 2 },
    planListNameSelected: { color: '#ffffff' },
    planListValidity: { fontSize: 10, fontWeight: '700', color: '#64748b' },
    planListValiditySelected: { color: '#fde047' },
    planRightSide: { alignItems: 'flex-end', justifyContent: 'center' },
    planListPrice: { fontSize: 14, fontWeight: '900', color: '#0d1b3e' },
    planListPriceSelected: { color: '#f5a623' },
    
    bottomBar: { position: 'absolute', bottom: Platform.OS === 'ios' ? 80 : 60, left: 0, right: 0, backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#f1f5f9', shadowColor: '#0a1633', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.08, shadowRadius: 15, elevation: 15 },
    bottomBarContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 20 : 12 },
    totalLabel: { color: '#64748b', fontSize: 10.5, fontWeight: '800', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
    totalAmount: { color: '#0d1b3e', fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
    payBtn: { borderRadius: 12, overflow: 'hidden', width: 120, shadowColor: '#f5a623', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
    payBtnDisabled: { opacity: 0.7, shadowOpacity: 0 },
    payBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 12, gap: 6 },
    payBtnTxt: { color: '#0d1b3e', fontSize: 13, fontWeight: '900', letterSpacing: 0.5 }
});
