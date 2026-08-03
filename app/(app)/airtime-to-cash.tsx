import React, { useState, useEffect } from 'react';
import { 
    View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, 
    ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image, LayoutAnimation, Dimensions 
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../services/supabase';
import * as Haptics from 'expo-haptics';
import { createAppNotification } from '../../services/notificationsHelper';

const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web' && width > 768;

const NETWORKS_DATA = [
    { id: '1', key: 'mtn', name: 'MTN', color: '#FFCC00', defaultRate: 82, otpLength: 6 },
    { id: '2', key: 'airtel', name: 'AIRTEL', color: '#FF0000', defaultRate: 80, otpLength: 4 },
    { id: '3', key: 'glo', name: 'GLO', color: '#0F6A37', defaultRate: 80, otpLength: 6 },
    { id: '4', key: '9mobile', name: '9MOBILE', color: '#006B3E', defaultRate: 80, otpLength: 6 },
    { id: '5', key: 'vitel', name: 'VITEL', color: '#6366F1', defaultRate: 80, otpLength: 6 },
];

const NETWORK_LOGOS: Record<string, any> = {
    mtn: require('../../assets/images/mtn.png'),
    airtel: require('../../assets/images/airtel.png'),
    glo: require('../../assets/images/glo.png'),
    '9mobile': require('../../assets/images/9mobile.png'),
    vitel: require('../../assets/images/vitel.png'),
};

export default function AirtimeToCashScreen() {
    const [userId, setUserId] = useState<string | null>(null);
    const [userPhone, setUserPhone] = useState<string | null>(null);

    // Form States
    const [networkId, setNetworkId] = useState<string>('1');
    const [phone, setPhone] = useState<string>('');
    const [otp, setOtp] = useState<string>('');
    const [amount, setAmount] = useState<string>('');
    const [sharePin, setSharePin] = useState<string>('');

    // Flow & Step Tracking
    const [otpSent, setOtpSent] = useState<boolean>(false);
    const [otpVerified, setOtpVerified] = useState<boolean>(false);
    const [sessionBlob, setSessionBlob] = useState<string>('');
    const [airtimeBalance, setAirtimeBalance] = useState<number | null>(null);

    // Loaders
    const [loadingOtp, setLoadingOtp] = useState<boolean>(false);
    const [loadingVerify, setLoadingVerify] = useState<boolean>(false);
    const [loadingConvert, setLoadingConvert] = useState<boolean>(false);

    // Rates & Balance
    const [rates, setRates] = useState<any[]>([]);
    const [walletBalance, setWalletBalance] = useState<number | null>(null);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            const { data: authData } = await supabase.auth.getUser();
            if (!authData?.user) return;
            setUserId(authData.user.id);

            // Fetch profile for phone and wallet balance
            const { data: prof } = await supabase.from('profiles').select('phone, balance').eq('id', authData.user.id).single();
            if (prof) {
                if (prof.phone) {
                    setUserPhone(prof.phone);
                    if (!phone) setPhone(prof.phone);
                }
                setWalletBalance(prof.balance || 0);
            }

            // Fetch Live Rates
            const { data: resData } = await supabase.functions.invoke('bills-payment', {
                body: { type: 'cash_rates' }
            });
            if (resData && resData.data) {
                setRates(resData.data);
            }
        } catch (e) {
            console.warn("Failed to fetch initial cash rates:", e);
        }
    };

    const getSelectedNetwork = () => {
        return NETWORKS_DATA.find(n => n.id === networkId) || NETWORKS_DATA[0];
    };

    const getBuybackPct = () => {
        const net = getSelectedNetwork();
        const match = rates.find((r: any) => r.plan_id === networkId || (r.network || '').toLowerCase().includes(net.key));
        return match ? parseFloat(match.buyback_pct) : net.defaultRate;
    };

    // 1. Send OTP Action
    const handleSendOtp = async () => {
        if (!phone || phone.trim().length < 11) {
            Alert.alert("Validation Error", "Please enter a valid 11-digit phone number holding the airtime.");
            return;
        }

        setLoadingOtp(true);
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            const { data: response, error } = await supabase.functions.invoke('bills-payment', {
                body: {
                    type: 'cash_step1',
                    providerParams: {
                        network: parseInt(networkId, 10),
                        phone: phone.trim()
                    }
                }
            });

            if (error || !response?.success) {
                throw new Error(response?.error || response?.message || error?.message || "Failed to send OTP.");
            }

            const blob = response?.data?.data;
            if (!blob) throw new Error(response?.data?.message || "Session blob token not returned by provider.");

            setSessionBlob(blob);
            setOtpSent(true);
            if (Platform.OS !== 'web') LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            Alert.alert("OTP Sent", response.data.message || `OTP security code sent to ${phone}`);
        } catch (err: any) {
            Alert.alert("Error Sending OTP", err.message || "Failed to send OTP. Please check phone number and retry.");
        } finally {
            setLoadingOtp(false);
        }
    };

    // 2. Verify OTP Action
    const handleVerifyOtp = async () => {
        const net = getSelectedNetwork();
        if (!otp || otp.trim().length < (net.otpLength || 4)) {
            Alert.alert("Validation Error", `Please enter the ${net.otpLength}-digit OTP sent to your phone.`);
            return;
        }

        setLoadingVerify(true);
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            const { data: response, error } = await supabase.functions.invoke('bills-payment', {
                body: {
                    type: 'cash_step2',
                    providerParams: {
                        network: parseInt(networkId, 10),
                        phone: phone.trim(),
                        otp: otp.trim(),
                        sessionBlob: sessionBlob
                    }
                }
            });

            if (error || !response?.success) {
                throw new Error(response?.error || response?.message || error?.message || "Invalid OTP code.");
            }

            const newBlob = response?.data?.data;
            const fetchedBal = response?.data?.balance;

            if (newBlob) setSessionBlob(newBlob);
            if (fetchedBal !== undefined) setAirtimeBalance(parseFloat(fetchedBal));

            setOtpVerified(true);
            if (Platform.OS !== 'web') LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        } catch (err: any) {
            Alert.alert("OTP Verification Failed", err.message || "OTP verification failed. Please restart if session expired.");
        } finally {
            setLoadingVerify(false);
        }
    };

    // 3. Finalise Conversion Action
    const handleConvertAirtime = async () => {
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount < 50) {
            Alert.alert("Validation Error", "Minimum airtime amount to convert is ₦50.");
            return;
        }

        if (airtimeBalance !== null && numAmount > airtimeBalance) {
            Alert.alert("Validation Error", `Amount exceeds your airtime balance of ₦${airtimeBalance.toLocaleString()}`);
            return;
        }

        if (!sharePin || sharePin.trim().length < 4) {
            Alert.alert("Validation Error", "Please enter your 4-digit Share & Sell PIN.");
            return;
        }

        setLoadingConvert(true);
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

        try {
            const { data: response, error } = await supabase.functions.invoke('bills-payment', {
                body: {
                    type: 'cash_step3',
                    providerParams: {
                        network: parseInt(networkId, 10),
                        phone: phone.trim(),
                        amount: numAmount,
                        sharePin: sharePin.trim(),
                        sessionBlob: sessionBlob
                    }
                }
            });

            if (error || !response?.success) {
                throw new Error(response?.error || response?.message || error?.message || "Airtime conversion failed.");
            }

            const credited = response?.data?.credited || (numAmount * (getBuybackPct() / 100));

            // Notify user
            if (userId) {
                await createAppNotification(
                    userId,
                    "Airtime to Cash Successful",
                    `Converted ₦${numAmount.toLocaleString()} airtime to ₦${credited.toLocaleString()} wallet cash.`,
                    "credit",
                    "normal",
                    { route: "/(app)/history" }
                );
            }

            router.replace({
                pathname: '/success',
                params: {
                    amount: `+₦${credited.toLocaleString()}`,
                    type: 'Airtime to Cash',
                    reference: response?.data?.transid || `AC_${Date.now()}`
                }
            });
        } catch (err: any) {
            Alert.alert("Conversion Failed", err.message || "Failed to convert airtime. Please restart step 1.");
        } finally {
            setLoadingConvert(false);
        }
    };

    const currentRate = getBuybackPct();
    const numAmount = parseFloat(amount) || 0;
    const youReceiveAmount = numAmount * (currentRate / 100);

    return (
        <View style={s.pageWrapper}>
            <Stack.Screen options={{ title: 'Airtime to Cash', headerStyle: { backgroundColor: '#121212' }, headerTintColor: '#fff' }} />
            <StatusBar style="light" />

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    
                    <View style={[s.layoutWrapper, isWeb && s.webLayoutWrapper]}>
                        
                        {/* LEFT MAIN FORM PANEL */}
                        <View style={[s.mainFormPanel, isWeb && s.webMainPanel]}>
                            
                            {/* 1. CHOOSE NETWORK */}
                            <Text style={s.stepTitle}>1 · CHOOSE NETWORK</Text>
                            <View style={s.networkGrid}>
                                {NETWORKS_DATA.map((net) => {
                                    const isSelected = networkId === net.id;
                                    const matchRate = rates.find((r: any) => r.plan_id === net.id || (r.network || '').toLowerCase().includes(net.key));
                                    const ratePct = matchRate ? matchRate.buyback_pct : net.defaultRate;
                                    return (
                                        <TouchableOpacity
                                            key={net.id}
                                            style={[
                                                s.networkCard,
                                                isSelected && s.networkCardSelected
                                            ]}
                                            onPress={() => setNetworkId(net.id)}
                                            activeOpacity={0.8}
                                        >
                                            <View style={s.logoCircle}>
                                                <Image source={NETWORK_LOGOS[net.key]} style={s.networkLogoImage} resizeMode="contain" />
                                            </View>
                                            <Text style={[s.networkCardTitle, isSelected && { color: '#ffffff' }]}>{net.name}</Text>
                                            <View style={s.pctBadge}>
                                                <Text style={s.pctBadgeText}>{ratePct}%</Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* 2. PHONE NUMBER WITH AIRTIME */}
                            <Text style={s.stepTitle}>2 · PHONE NUMBER WITH AIRTIME</Text>
                            <View style={s.phoneInputWrapper}>
                                <TextInput
                                    value={phone}
                                    onChangeText={setPhone}
                                    placeholder="08012345678"
                                    placeholderTextColor="#555555"
                                    keyboardType="phone-pad"
                                    maxLength={11}
                                    style={s.phoneInput}
                                />
                                <TouchableOpacity
                                    onPress={handleSendOtp}
                                    disabled={loadingOtp}
                                    style={[s.sendOtpBtn, loadingOtp && { opacity: 0.6 }]}
                                    activeOpacity={0.8}
                                >
                                    {loadingOtp ? (
                                        <ActivityIndicator color="#ffffff" size="small" />
                                    ) : (
                                        <Text style={s.sendOtpBtnText}>{otpSent ? 'Resend OTP' : 'Send OTP'}</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                            <Text style={s.helperSubtext}>We send an OTP to this number to confirm the airtime is yours</Text>

                            {/* 3. ENTER THE OTP */}
                            <Text style={s.stepTitle}>3 · ENTER THE {getSelectedNetwork().otpLength}-DIGIT OTP</Text>
                            {otpSent ? (
                                <View style={s.otpBoxActive}>
                                    <View style={s.phoneInputWrapper}>
                                        <TextInput
                                            value={otp}
                                            onChangeText={setOtp}
                                            placeholder={`Enter ${getSelectedNetwork().otpLength}-digit code...`}
                                            placeholderTextColor="#555555"
                                            keyboardType="number-pad"
                                            maxLength={getSelectedNetwork().otpLength}
                                            style={[s.phoneInput, { letterSpacing: 4, fontWeight: '800' }]}
                                        />
                                        <TouchableOpacity
                                            onPress={handleVerifyOtp}
                                            disabled={loadingVerify}
                                            style={[s.sendOtpBtn, { backgroundColor: '#16a34a' }]}
                                            activeOpacity={0.8}
                                        >
                                            {loadingVerify ? (
                                                <ActivityIndicator color="#ffffff" size="small" />
                                            ) : (
                                                <Text style={s.sendOtpBtnText}>Verify OTP</Text>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : (
                                <View style={s.otpBoxDotted}>
                                    <Text style={s.otpPlaceholderText}>OTP box will appear once we send the code</Text>
                                </View>
                            )}

                            {/* 4. CONVERSION DETAILS */}
                            <Text style={s.stepTitle}>4 · CONVERSION DETAILS</Text>
                            <View style={s.inputBlock}>
                                <Text style={s.inputFieldLabel}>Airtime amount to convert</Text>
                                <View style={s.amountInputRow}>
                                    <Text style={s.nairaPrefix}>₦</Text>
                                    <TextInput
                                        value={amount}
                                        onChangeText={setAmount}
                                        placeholder="0"
                                        placeholderTextColor="#555555"
                                        keyboardType="number-pad"
                                        style={s.amountInput}
                                    />
                                </View>
                                <Text style={s.helperSubtext}>How much airtime are you converting?</Text>
                            </View>

                            <View style={s.inputBlock}>
                                <View style={s.pinInputRow}>
                                    <TextInput
                                        value={sharePin}
                                        onChangeText={setSharePin}
                                        placeholder="Share & Sell PIN"
                                        placeholderTextColor="#555555"
                                        secureTextEntry
                                        keyboardType="number-pad"
                                        maxLength={4}
                                        style={s.pinInput}
                                    />
                                    <Ionicons name="lock-closed-outline" size={18} color="#666666" style={{ marginRight: 12 }} />
                                </View>
                                <Text style={s.helperSubtext}>Your airtime-transfer PIN (different from your wallet PIN)</Text>
                            </View>

                            {/* Convert Action Button */}
                            <TouchableOpacity
                                onPress={handleConvertAirtime}
                                disabled={loadingConvert || !otpVerified}
                                style={[s.actionConvertBtn, (!otpVerified || loadingConvert) && s.actionConvertBtnDisabled]}
                                activeOpacity={0.85}
                            >
                                {loadingConvert ? (
                                    <ActivityIndicator color="#ffffff" size="small" />
                                ) : (
                                    <Text style={s.actionConvertBtnText}>
                                        {numAmount > 0 ? `Convert ₦${numAmount.toLocaleString()} to Cash >` : 'Enter An Amount To Continue >'}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* RIGHT SUMMARY SIDE PANEL */}
                        <View style={[s.sideSummaryPanel, isWeb && s.webSidePanel]}>
                            
                            {/* Golden Balance Card */}
                            <LinearGradient colors={['#eab308', '#ca8a04', '#a16207']} style={s.goldenBalanceCard}>
                                <Text style={s.goldenBalLabel}>Wallet balance</Text>
                                <Text style={s.goldenBalAmount}>
                                    ₦{walletBalance !== null ? walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
                                </Text>
                                <TouchableOpacity onPress={() => router.push('/wallet')} style={s.addMoneyBtn} activeOpacity={0.8}>
                                    <Ionicons name="add-circle-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                                    <Text style={s.addMoneyBtnText}>Add Money</Text>
                                </TouchableOpacity>
                            </LinearGradient>

                            {/* Conversion Summary Card */}
                            <View style={s.summaryCard}>
                                <Text style={s.summaryCardTitle}>CONVERSION SUMMARY</Text>
                                
                                <View style={s.summaryRow}>
                                    <Text style={s.summaryLabel}>Network</Text>
                                    <Text style={s.summaryValue}>{getSelectedNetwork().name}</Text>
                                </View>
                                
                                <View style={s.summaryRow}>
                                    <Text style={s.summaryLabel}>Rate</Text>
                                    <Text style={s.summaryValue}>{currentRate}%</Text>
                                </View>

                                <View style={s.summaryRow}>
                                    <Text style={s.summaryLabel}>Phone</Text>
                                    <Text style={s.summaryValue}>{phone || '—'}</Text>
                                </View>

                                <View style={s.summaryRow}>
                                    <Text style={s.summaryLabel}>Airtime sold</Text>
                                    <Text style={s.summaryValue}>{numAmount > 0 ? `₦${numAmount.toLocaleString()}` : '—'}</Text>
                                </View>

                                <View style={s.summaryDivider} />

                                <View style={s.summaryRow}>
                                    <Text style={s.youReceiveLabel}>You receive</Text>
                                    <Text style={s.youReceiveValue}>
                                        {youReceiveAmount > 0 ? `₦${youReceiveAmount.toLocaleString()}` : '—'}
                                    </Text>
                                </View>
                            </View>

                            {/* Notice Box */}
                            <View style={s.noticeBox}>
                                <Ionicons name="information-circle" size={18} color="#eab308" style={{ marginRight: 8, marginTop: 2 }} />
                                <Text style={s.noticeText}>
                                    We use your network's Share & Sell to pull airtime from your line. Cash lands in your wallet once the transfer settles.
                                </Text>
                            </View>

                        </View>
                    </View>

                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const s = StyleSheet.create({
    pageWrapper: {
        flex: 1,
        backgroundColor: '#121212',
    },
    container: {
        padding: 16,
    },
    layoutWrapper: {
        flexDirection: 'column',
        gap: 20,
    },
    webLayoutWrapper: {
        flexDirection: 'row',
        maxWidth: 1200,
        alignSelf: 'center',
        width: '100%',
    },
    mainFormPanel: {
        flex: 1,
        backgroundColor: '#1e1e1e',
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        borderColor: '#2e2e2e',
    },
    webMainPanel: {
        flex: 2,
    },
    sideSummaryPanel: {
        flex: 1,
        flexDirection: 'column',
        gap: 16,
    },
    webSidePanel: {
        flex: 1,
    },
    stepTitle: {
        fontSize: 11,
        fontWeight: '900',
        color: '#888888',
        letterSpacing: 1,
        marginTop: 16,
        marginBottom: 10,
        textTransform: 'uppercase',
    },
    networkGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 8,
    },
    networkCard: {
        width: 100,
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 14,
        backgroundColor: '#262626',
        borderWidth: 1.5,
        borderColor: '#333333',
        alignItems: 'center',
        justifyContent: 'center',
    },
    networkCardSelected: {
        borderColor: '#eab308',
        backgroundColor: '#2e2a18',
    },
    logoCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
    },
    networkLogoImage: {
        width: '100%',
        height: '100%',
    },
    networkCardTitle: {
        fontSize: 10.5,
        fontWeight: '800',
        color: '#888888',
        marginBottom: 4,
    },
    pctBadge: {
        backgroundColor: 'rgba(34, 197, 94, 0.15)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    pctBadgeText: {
        fontSize: 9,
        fontWeight: '800',
        color: '#22c55e',
    },
    phoneInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#262626',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333333',
        paddingHorizontal: 14,
        height: 52,
    },
    phoneInput: {
        flex: 1,
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '700',
    },
    sendOtpBtn: {
        backgroundColor: '#333333',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
    },
    sendOtpBtnText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '800',
    },
    helperSubtext: {
        fontSize: 10.5,
        color: '#666666',
        marginTop: 6,
    },
    otpBoxDotted: {
        backgroundColor: '#222222',
        borderWidth: 1.5,
        borderColor: '#333333',
        borderStyle: 'dashed',
        borderRadius: 14,
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    otpBoxActive: {
        marginBottom: 8,
    },
    otpPlaceholderText: {
        color: '#555555',
        fontSize: 12,
    },
    inputBlock: {
        marginTop: 10,
    },
    inputFieldLabel: {
        fontSize: 11,
        color: '#777777',
        marginBottom: 6,
    },
    amountInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#262626',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333333',
        paddingHorizontal: 14,
        height: 52,
    },
    nairaPrefix: {
        color: '#888888',
        fontSize: 18,
        fontWeight: '700',
        marginRight: 6,
    },
    amountInput: {
        flex: 1,
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '800',
    },
    pinInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#262626',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333333',
        paddingHorizontal: 14,
        height: 52,
        marginTop: 6,
    },
    pinInput: {
        flex: 1,
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '700',
    },
    actionConvertBtn: {
        backgroundColor: '#2563eb',
        borderRadius: 14,
        height: 54,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 24,
    },
    actionConvertBtnDisabled: {
        backgroundColor: '#333333',
    },
    actionConvertBtnText: {
        color: '#ffffff',
        fontSize: 14.5,
        fontWeight: '800',
    },
    goldenBalanceCard: {
        borderRadius: 20,
        padding: 20,
        shadowColor: '#eab308',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 4,
    },
    goldenBalLabel: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    goldenBalAmount: {
        color: '#ffffff',
        fontSize: 26,
        fontWeight: '900',
        marginVertical: 8,
    },
    addMoneyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 12,
        alignSelf: 'flex-start',
    },
    addMoneyBtnText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '800',
    },
    summaryCard: {
        backgroundColor: '#1e1e1e',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: '#2e2e2e',
    },
    summaryCardTitle: {
        fontSize: 11,
        fontWeight: '900',
        color: '#888888',
        letterSpacing: 1,
        marginBottom: 16,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    summaryLabel: {
        fontSize: 12.5,
        color: '#888888',
    },
    summaryValue: {
        fontSize: 12.5,
        fontWeight: '700',
        color: '#ffffff',
    },
    summaryDivider: {
        height: 1,
        backgroundColor: '#2e2e2e',
        marginVertical: 12,
    },
    youReceiveLabel: {
        fontSize: 14,
        fontWeight: '800',
        color: '#ffffff',
    },
    youReceiveValue: {
        fontSize: 16,
        fontWeight: '900',
        color: '#22c55e',
    },
    noticeBox: {
        flexDirection: 'row',
        backgroundColor: '#1e1e1e',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: '#2e2e2e',
    },
    noticeText: {
        flex: 1,
        fontSize: 11,
        color: '#888888',
        lineHeight: 16,
    },
});
