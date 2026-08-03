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

const ALL_NETWORKS = [
    { id: '1', key: 'mtn', name: 'MTN', color: '#FFCC00', defaultRate: 80, otpLength: 6 },
    { id: '2', key: 'airtel', name: 'AIRTEL', color: '#FF0000', defaultRate: 80, otpLength: 4 },
    { id: '3', key: 'glo', name: 'GLO', color: '#0F6A37', defaultRate: 80, otpLength: 6 },
    { id: '4', key: '9mobile', name: '9MOBILE', color: '#006B3E', defaultRate: 80, otpLength: 6 },
];

const NETWORK_LOGOS: Record<string, any> = {
    mtn: require('../../assets/images/mtn.png'),
    airtel: require('../../assets/images/airtel.png'),
    glo: require('../../assets/images/glo.png'),
    '9mobile': require('../../assets/images/9mobile.png'),
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

    // Status Banner for Feedback
    const [statusBanner, setStatusBanner] = useState<{ text: string, type: 'error' | 'success' | 'info' } | null>(null);

    // Rates & Balance
    const [rates, setRates] = useState<any[]>([]);
    const [walletBalance, setWalletBalance] = useState<number | null>(null);

    const showNotify = (title: string, message: string, type: 'error' | 'success' | 'info' = 'info') => {
        setStatusBanner({ text: `${title}: ${message}`, type });
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
            window.alert(`${title}\n\n${message}`);
        } else {
            Alert.alert(title, message);
        }
    };

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
                    handlePhoneChange(prof.phone);
                }
                setWalletBalance(prof.balance || 0);
            }

            // Fetch Live Rates from Bilalsadasub API
            const { data: resData } = await supabase.functions.invoke('bills-payment', {
                body: { type: 'cash_rates' }
            });
            if (resData && resData.data && Array.isArray(resData.data)) {
                setRates(resData.data);
            }
        } catch (e) {
            console.warn("Failed to fetch initial cash rates:", e);
        }
    };

    // Auto-detect Network from phone prefix (MTN vs Airtel)
    const detectNetworkFromPhone = (num: string): string | null => {
        if (!num) return null;
        let clean = num.replace(/[^0-9]/g, '');
        if (clean.startsWith('234')) {
            clean = '0' + clean.substring(3);
        }
        if (clean.length < 4) return null;
        const prefix = clean.substring(0, 4);

        const mtnPrefixes = ['0803','0806','0813','0816','0810','0814','0903','0906','0703','0706','0913','0916','0702','0704','0707'];
        const airtelPrefixes = ['0802','0808','0812','0708','0701','0902','0907','0901','0912'];

        if (mtnPrefixes.includes(prefix)) return '1'; // MTN
        if (airtelPrefixes.includes(prefix)) return '2'; // AIRTEL
        return null;
    };

    const handlePhoneChange = (text: string) => {
        setPhone(text);
        const autoNet = detectNetworkFromPhone(text);
        if (autoNet) {
            setNetworkId(autoNet);
        }
    };

    // Filter ONLY active networks (default MTN & AIRTEL)
    const getAvailableNetworks = () => {
        if (rates.length > 0) {
            const activeList = ALL_NETWORKS.filter(net => rates.some((r: any) => r.plan_id === net.id || (r.network || '').toLowerCase().includes(net.key)));
            return activeList.length > 0 ? activeList : ALL_NETWORKS.slice(0, 2);
        }
        return ALL_NETWORKS.slice(0, 2); // Default 2 active networks: MTN & AIRTEL
    };

    const displayNetworks = getAvailableNetworks();

    const getSelectedNetwork = () => {
        return displayNetworks.find(n => n.id === networkId) || displayNetworks[0];
    };

    const getBuybackPct = () => {
        const net = getSelectedNetwork();
        const match = rates.find((r: any) => r.plan_id === networkId || (r.network || '').toLowerCase().includes(net.key));
        return match ? parseFloat(match.buyback_pct) : net.defaultRate;
    };

    // 1. Send OTP Action
    const handleSendOtp = async () => {
        let cleanPhone = (phone || '').replace(/[^0-9]/g, '');
        if (cleanPhone.startsWith('234')) cleanPhone = '0' + cleanPhone.substring(3);

        if (!cleanPhone || cleanPhone.length < 11) {
            showNotify("Validation Error", "Please enter a valid 11-digit phone number.", "error");
            return;
        }

        setLoadingOtp(true);
        setStatusBanner({ text: `Sending OTP to ${cleanPhone}...`, type: 'info' });
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            console.log(`[AirtimeToCash] Invoking cash_step1 for phone ${cleanPhone}, network ${networkId}`);
            const { data: response, error } = await supabase.functions.invoke('bills-payment', {
                body: {
                    type: 'cash_step1',
                    providerParams: {
                        network: parseInt(networkId, 10),
                        phone: cleanPhone
                    }
                }
            });

            if (error || !response?.success) {
                const errMsg = response?.error || response?.message || error?.message || "Failed to send OTP to line.";
                throw new Error(errMsg);
            }

            const blob = response?.data?.data;
            if (!blob) throw new Error(response?.data?.message || "Telecom provider did not return session blob.");

            setSessionBlob(blob);
            setOtpSent(true);
            if (Platform.OS !== 'web') LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            showNotify("OTP Sent ✓", response.data.message || `SMS security code sent to ${cleanPhone}. Enter OTP below to continue.`, "success");
        } catch (err: any) {
            console.error("[AirtimeToCash] Error in cash_step1:", err);
            showNotify("Error Sending OTP", err.message || "Failed to send OTP. Please check phone number and retry.", "error");
        } finally {
            setLoadingOtp(false);
        }
    };

    // 2. Verify OTP Action
    const handleVerifyOtp = async () => {
        const net = getSelectedNetwork();
        const cleanOtp = (otp || '').trim();

        if (!cleanOtp || cleanOtp.length < (net.otpLength || 4)) {
            showNotify("Validation Error", `Please enter the ${net.otpLength || 4}-digit OTP code sent via SMS to your line.`, "error");
            return false;
        }

        if (!sessionBlob) {
            showNotify("OTP Session Missing", "Please tap 'Send OTP to Line' first to receive an SMS security code.", "error");
            return false;
        }

        setLoadingVerify(true);
        setStatusBanner({ text: `Verifying ${cleanOtp} with telecom provider...`, type: 'info' });
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            console.log(`[AirtimeToCash] Invoking cash_step2 for phone ${phone}, otp ${cleanOtp}`);
            const { data: response, error } = await supabase.functions.invoke('bills-payment', {
                body: {
                    type: 'cash_step2',
                    providerParams: {
                        network: parseInt(networkId, 10),
                        phone: phone.trim(),
                        otp: cleanOtp,
                        sessionBlob: sessionBlob
                    }
                }
            });

            if (error || !response?.success) {
                const errMsg = response?.error || response?.message || error?.message || "Invalid OTP code entered.";
                throw new Error(errMsg);
            }

            const newBlob = response?.data?.data;
            const fetchedBal = response?.data?.balance;

            if (newBlob) setSessionBlob(newBlob);
            if (fetchedBal !== undefined) setAirtimeBalance(parseFloat(fetchedBal));

            setOtpVerified(true);
            if (Platform.OS !== 'web') LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

            showNotify("OTP Verified ✓", response?.data?.message || "Line verified successfully! Now enter airtime amount & Share PIN below.", "success");
            return true;
        } catch (err: any) {
            console.error("[AirtimeToCash] Error in cash_step2:", err);
            showNotify("OTP Verification Failed", err.message || "Invalid OTP code. Please check code or tap Send OTP again.", "error");
            return false;
        } finally {
            setLoadingVerify(false);
        }
    };

    // 3. Seamless Combined Submit Action (Send OTP -> Verify -> Finalise in 1 Flow)
    const handleConvertAirtime = async () => {
        let cleanPhone = (phone || '').replace(/[^0-9]/g, '');
        if (cleanPhone.startsWith('234')) cleanPhone = '0' + cleanPhone.substring(3);

        if (!cleanPhone || cleanPhone.length < 11) {
            showNotify("Validation Error", "Please enter a valid 11-digit phone number.", "error");
            return;
        }

        // Auto-Trigger Step 1 if OTP was not sent yet
        if (!sessionBlob && !otpSent) {
            await handleSendOtp();
            showNotify("OTP Sent", "Security OTP has been sent to your line. Please enter the OTP code to complete conversion.", "info");
            return;
        }

        // Auto-Trigger Step 2 if OTP is entered but not verified
        if (!otpVerified && otp.trim().length >= 4) {
            const verifiedOk = await handleVerifyOtp();
            if (!verifiedOk) return;
        }

        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount < 50) {
            showNotify("Validation Error", "Minimum airtime amount to convert is ₦50.", "error");
            return;
        }

        if (airtimeBalance !== null && numAmount > airtimeBalance) {
            showNotify("Validation Error", `Amount exceeds your line's available airtime balance of ₦${airtimeBalance.toLocaleString()}`, "error");
            return;
        }

        if (!sharePin || sharePin.trim().length < 4) {
            showNotify("Validation Error", "Please enter your 4-digit Share & Sell PIN.", "error");
            return;
        }

        setLoadingConvert(true);
        setStatusBanner({ text: `Processing ₦${numAmount.toLocaleString()} airtime conversion...`, type: 'info' });
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

        try {
            console.log(`[AirtimeToCash] Invoking cash_step3 for phone ${cleanPhone}, amount ₦${numAmount}`);
            const { data: response, error } = await supabase.functions.invoke('bills-payment', {
                body: {
                    type: 'cash_step3',
                    providerParams: {
                        network: parseInt(networkId, 10),
                        phone: cleanPhone,
                        amount: numAmount,
                        sharePin: sharePin.trim(),
                        sessionBlob: sessionBlob
                    }
                }
            });

            if (error || !response?.success) {
                const errMsg = response?.error || response?.message || error?.message || "Airtime conversion failed.";
                throw new Error(errMsg);
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
            console.error("[AirtimeToCash] Error in cash_step3:", err);
            showNotify("Conversion Failed", err.message || "Failed to convert airtime to cash.", "error");
        } finally {
            setLoadingConvert(false);
        }
    };

    const currentRate = getBuybackPct();
    const numAmount = parseFloat(amount) || 0;
    const youReceiveAmount = numAmount * (currentRate / 100);

    return (
        <View style={s.pageWrapper}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
                
                {/* Curved Navy Header with Prominent Wallet Balance */}
                <LinearGradient colors={['#060d21', '#0d1b3e', '#1e293b']} style={s.headerContainer}>
                    <View style={s.headerTop}>
                        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
                            <Ionicons name="arrow-back" size={18} color="white" />
                        </TouchableOpacity>
                        <View style={{ alignItems: 'center' }}>
                            <Text style={s.headerTitle}>Airtime ➔ Cash</Text>
                            <Text style={s.headerSubtitle}>Convert airtime directly into wallet cash</Text>
                        </View>
                        <View style={s.headerBalanceBadge}>
                            <Ionicons name="wallet-outline" size={12} color="#f5a623" style={{ marginRight: 4 }} />
                            <Text style={s.headerBalanceVal}>
                                ₦{walletBalance !== null ? walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
                            </Text>
                        </View>
                    </View>
                </LinearGradient>

                <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    
                    <View style={[s.layoutWrapper, isWeb && s.webLayoutWrapper]}>
                        
                        {/* LEFT MAIN FORM PANEL */}
                        <View style={[s.mainFormPanel, isWeb && s.webMainPanel]}>
                            
                            {/* Live Status Banner for Instant Feedback */}
                            {statusBanner && (
                                <View style={[
                                    s.statusBannerCard,
                                    statusBanner.type === 'error' && { backgroundColor: '#fef2f2', borderColor: '#fca5a5' },
                                    statusBanner.type === 'success' && { backgroundColor: '#f0fdf4', borderColor: '#86efac' },
                                    statusBanner.type === 'info' && { backgroundColor: '#eff6ff', borderColor: '#93c5fd' },
                                ]}>
                                    <Ionicons 
                                        name={statusBanner.type === 'error' ? 'alert-circle' : statusBanner.type === 'success' ? 'checkmark-circle' : 'information-circle'} 
                                        size={18} 
                                        color={statusBanner.type === 'error' ? '#dc2626' : statusBanner.type === 'success' ? '#16a34a' : '#2563eb'} 
                                        style={{ marginRight: 8 }}
                                    />
                                    <Text style={[
                                        s.statusBannerText,
                                        statusBanner.type === 'error' && { color: '#991b1b' },
                                        statusBanner.type === 'success' && { color: '#166534' },
                                        statusBanner.type === 'info' && { color: '#1e40af' },
                                    ]}>{statusBanner.text}</Text>
                                    <TouchableOpacity onPress={() => setStatusBanner(null)} style={{ marginLeft: 6 }}>
                                        <Ionicons name="close" size={16} color="#64748b" />
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* 1. CHOOSE NETWORK (Auto-Detected or Selectable) */}
                            <Text style={s.stepTitle}>1 · CHOOSE NETWORK</Text>
                            <View style={s.network2ColumnGrid}>
                                {displayNetworks.map((net) => {
                                    const isSelected = networkId === net.id;
                                    const matchRate = rates.find((r: any) => r.plan_id === net.id || (r.network || '').toLowerCase().includes(net.key));
                                    const ratePct = matchRate ? matchRate.buyback_pct : net.defaultRate;
                                    return (
                                        <TouchableOpacity
                                            key={net.id}
                                            style={[
                                                s.network2Card,
                                                isSelected && { borderColor: net.color, backgroundColor: net.color + '15', borderWidth: 2.5 }
                                            ]}
                                            onPress={() => setNetworkId(net.id)}
                                            activeOpacity={0.8}
                                        >
                                            <View style={s.logoCircle}>
                                                <Image source={NETWORK_LOGOS[net.key]} style={s.networkLogoImage} resizeMode="contain" />
                                            </View>
                                            <Text style={[s.networkCardTitle, isSelected && { color: net.color, fontWeight: '900' }]} numberOfLines={1}>
                                                {net.name} {isSelected && '✓'}
                                            </Text>
                                            <View style={[s.pctBadge, { backgroundColor: (net.color || '#22c55e') + '20' }]}>
                                                <Text style={[s.pctBadgeText, { color: net.color || '#22c55e' }]}>{ratePct}% Payout</Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* 2. PHONE NUMBER WITH AIRTIME */}
                            <Text style={s.stepTitle}>2 · PHONE NUMBER WITH AIRTIME</Text>
                            <View style={s.phoneInputBlock}>
                                <View style={s.compactInputRow}>
                                    <Ionicons name="call-outline" size={16} color="#64748b" style={{ marginRight: 6 }} />
                                    <TextInput
                                        value={phone}
                                        onChangeText={handlePhoneChange}
                                        placeholder="08012345678"
                                        placeholderTextColor="#94a3b8"
                                        keyboardType="phone-pad"
                                        maxLength={11}
                                        style={s.compactTextInput}
                                    />
                                    {userPhone && phone !== userPhone && (
                                        <TouchableOpacity onPress={() => handlePhoneChange(userPhone)} style={s.myLineChip} activeOpacity={0.7}>
                                            <Text style={s.myLineChipText}>My Line</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {/* Sleek Send OTP Action Button */}
                                <TouchableOpacity
                                    onPress={handleSendOtp}
                                    disabled={loadingOtp}
                                    style={[s.sendOtpBtnFull, loadingOtp && { opacity: 0.6 }]}
                                    activeOpacity={0.8}
                                >
                                    {loadingOtp ? (
                                        <ActivityIndicator color="#ffffff" size="small" />
                                    ) : (
                                        <>
                                            <Text style={s.sendOtpBtnFullText}>{otpSent ? 'Resend Security OTP' : 'Send OTP to Line'}</Text>
                                            <Ionicons name="arrow-forward-circle-outline" size={16} color="white" style={{ marginLeft: 6 }} />
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                            <Text style={s.helperSubtext}>We send an OTP to this number to confirm the airtime is yours</Text>

                            {/* 3. ENTER THE OTP */}
                            <Text style={s.stepTitle}>3 · ENTER THE {getSelectedNetwork().otpLength}-DIGIT OTP</Text>
                            <View style={s.compactInputRow}>
                                <Ionicons name="keypad-outline" size={16} color="#64748b" style={{ marginRight: 6 }} />
                                <TextInput
                                    value={otp}
                                    onChangeText={setOtp}
                                    placeholder={`Enter ${getSelectedNetwork().otpLength}-digit code`}
                                    placeholderTextColor="#94a3b8"
                                    keyboardType="number-pad"
                                    maxLength={getSelectedNetwork().otpLength}
                                    style={[s.compactTextInput, { letterSpacing: 3, fontWeight: '800' }]}
                                />
                                <TouchableOpacity
                                    onPress={handleVerifyOtp}
                                    disabled={loadingVerify}
                                    style={[s.verifyBtnInline, otpVerified && { backgroundColor: '#15803d' }]}
                                    activeOpacity={0.8}
                                >
                                    {loadingVerify ? (
                                        <ActivityIndicator color="#ffffff" size="small" />
                                    ) : (
                                        <Text style={s.verifyBtnInlineText}>
                                            {otpVerified ? 'Verified ✓' : 'Verify OTP'}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                            <Text style={s.helperSubtext}>Enter the SMS security code sent to your line</Text>

                            {/* 4. CONVERSION DETAILS */}
                            <Text style={s.stepTitle}>4 · CONVERSION DETAILS</Text>
                            <View style={s.inputBlock}>
                                <Text style={s.inputFieldLabel}>Airtime amount to convert (₦)</Text>
                                <View style={s.compactInputRow}>
                                    <Text style={s.nairaPrefix}>₦</Text>
                                    <TextInput
                                        value={amount}
                                        onChangeText={setAmount}
                                        placeholder="0"
                                        placeholderTextColor="#94a3b8"
                                        keyboardType="number-pad"
                                        style={[s.compactTextInput, { fontWeight: '800' }]}
                                    />
                                </View>
                                <Text style={s.helperSubtext}>How much airtime are you converting?</Text>
                            </View>

                            <View style={s.inputBlock}>
                                <Text style={s.inputFieldLabel}>Share & Sell PIN</Text>
                                <View style={s.compactInputRow}>
                                    <Ionicons name="lock-closed-outline" size={16} color="#64748b" style={{ marginRight: 6 }} />
                                    <TextInput
                                        value={sharePin}
                                        onChangeText={setSharePin}
                                        placeholder="1234"
                                        placeholderTextColor="#94a3b8"
                                        secureTextEntry
                                        keyboardType="number-pad"
                                        maxLength={4}
                                        style={[s.compactTextInput, { letterSpacing: 3 }]}
                                    />
                                </View>
                                <Text style={s.helperSubtext}>Your airtime-transfer PIN (different from your wallet PIN)</Text>
                            </View>

                            {/* Main Active Submit Button */}
                            <TouchableOpacity
                                onPress={handleConvertAirtime}
                                disabled={loadingConvert}
                                style={[s.actionConvertBtn, loadingConvert && { opacity: 0.6 }]}
                                activeOpacity={0.85}
                            >
                                {loadingConvert ? (
                                    <ActivityIndicator color="#ffffff" size="small" />
                                ) : (
                                    <Text style={s.actionConvertBtnText}>
                                        {numAmount > 0 ? `Convert ₦${numAmount.toLocaleString()} to Cash >` : 'Submit Conversion >'}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* RIGHT SUMMARY SIDE PANEL WITH GOLDEN WALLET CARD */}
                        <View style={[s.sideSummaryPanel, isWeb && s.webSidePanel]}>
                            
                            {/* Golden Wallet Balance Card */}
                            <LinearGradient colors={['#eab308', '#ca8a04', '#a16207']} style={s.goldenBalanceCard}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={s.goldenBalLabel}>Wallet balance</Text>
                                    <Ionicons name="wallet-outline" size={20} color="#ffffff" />
                                </View>
                                <Text style={s.goldenBalAmount}>
                                    ₦{walletBalance !== null ? walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
                                </Text>
                                <TouchableOpacity onPress={() => router.push('/wallet')} style={s.addMoneyBtn} activeOpacity={0.8}>
                                    <Ionicons name="add-circle-outline" size={14} color="#ffffff" style={{ marginRight: 4 }} />
                                    <Text style={s.addMoneyBtnText}>+ Add Money</Text>
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
                                <Ionicons name="information-circle" size={16} color="#d97706" style={{ marginRight: 6, marginTop: 2 }} />
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
        backgroundColor: '#f4f6fb',
    },
    headerContainer: {
        paddingTop: Platform.OS === 'ios' ? 48 : 36,
        paddingBottom: 16,
        paddingHorizontal: 16,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    backBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '800',
    },
    headerSubtitle: {
        color: '#94a3b8',
        fontSize: 10,
        fontWeight: '600',
        marginTop: 1,
    },
    headerBalanceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(245, 166, 35, 0.25)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(245, 166, 35, 0.4)',
    },
    headerBalanceVal: {
        color: '#f5a623',
        fontSize: 11,
        fontWeight: '800',
    },
    container: {
        padding: 12,
    },
    layoutWrapper: {
        flexDirection: 'column',
        gap: 12,
    },
    webLayoutWrapper: {
        flexDirection: 'row',
        maxWidth: 1200,
        alignSelf: 'center',
        width: '100%',
    },
    mainFormPanel: {
        flex: 1,
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 2,
    },
    webMainPanel: {
        flex: 2,
    },
    sideSummaryPanel: {
        flex: 1,
        flexDirection: 'column',
        gap: 12,
    },
    webSidePanel: {
        flex: 1,
    },
    stepTitle: {
        fontSize: 10,
        fontWeight: '900',
        color: '#475569',
        letterSpacing: 0.8,
        marginTop: 10,
        marginBottom: 6,
        textTransform: 'uppercase',
    },
    // 2-Column Active Network Grid (MTN & AIRTEL)
    network2ColumnGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8,
        marginBottom: 6,
        width: '100%',
    },
    network2Card: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 14,
        backgroundColor: '#f8fafc',
        borderWidth: 1.5,
        borderColor: '#cbd5e1',
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
    },
    networkLogoImage: {
        width: '100%',
        height: '100%',
    },
    networkCardTitle: {
        fontSize: 11,
        fontWeight: '800',
        color: '#334155',
        marginBottom: 3,
        textAlign: 'center',
    },
    pctBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    pctBadgeText: {
        fontSize: 9.5,
        fontWeight: '800',
    },
    phoneInputBlock: {
        gap: 6,
    },
    compactInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#cbd5e1',
        paddingHorizontal: 12,
        height: 50,
        marginVertical: 2,
    },
    compactTextInput: {
        flex: 1,
        color: '#0d1b3e',
        fontSize: 15,
        fontWeight: '700',
        height: '100%',
        paddingVertical: 0,
    },
    myLineChip: {
        backgroundColor: '#e0e7ff',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    myLineChipText: {
        color: '#3730a3',
        fontSize: 9.5,
        fontWeight: '800',
    },
    sendOtpBtnFull: {
        backgroundColor: '#2563eb',
        borderRadius: 10,
        height: 40,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
    },
    sendOtpBtnFullText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '800',
    },
    verifyBtnInline: {
        backgroundColor: '#2563eb',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    verifyBtnInlineText: {
        color: '#ffffff',
        fontSize: 10.5,
        fontWeight: '800',
    },
    helperSubtext: {
        fontSize: 9.5,
        color: '#64748b',
        marginTop: 4,
    },
    inputBlock: {
        marginTop: 6,
    },
    inputFieldLabel: {
        fontSize: 10.5,
        fontWeight: '700',
        color: '#475569',
        marginBottom: 4,
    },
    nairaPrefix: {
        color: '#64748b',
        fontSize: 15,
        fontWeight: '800',
        marginRight: 4,
    },
    actionConvertBtn: {
        backgroundColor: '#16a34a',
        borderRadius: 14,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 18,
        shadowColor: '#16a34a',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 3,
    },
    actionConvertBtnText: {
        color: '#ffffff',
        fontSize: 13.5,
        fontWeight: '800',
    },
    goldenBalanceCard: {
        borderRadius: 16,
        padding: 16,
        shadowColor: '#eab308',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    goldenBalLabel: {
        color: 'rgba(255, 255, 255, 0.9)',
        fontSize: 10.5,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    goldenBalAmount: {
        color: '#ffffff',
        fontSize: 24,
        fontWeight: '900',
        marginVertical: 6,
    },
    addMoneyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
        alignSelf: 'flex-start',
    },
    addMoneyBtnText: {
        color: '#ffffff',
        fontSize: 11,
        fontWeight: '800',
    },
    summaryCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
    },
    summaryCardTitle: {
        fontSize: 10,
        fontWeight: '900',
        color: '#475569',
        letterSpacing: 0.8,
        marginBottom: 10,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    summaryLabel: {
        fontSize: 11,
        color: '#64748b',
    },
    summaryValue: {
        fontSize: 11,
        fontWeight: '700',
        color: '#0d1b3e',
    },
    summaryDivider: {
        height: 1,
        backgroundColor: '#cbd5e1',
        marginVertical: 8,
    },
    youReceiveLabel: {
        fontSize: 12,
        fontWeight: '800',
        color: '#0d1b3e',
    },
    youReceiveValue: {
        fontSize: 14,
        fontWeight: '900',
        color: '#16a34a',
    },
    noticeBox: {
        flexDirection: 'row',
        backgroundColor: '#fffbeb',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1.5,
        borderColor: '#fde68a',
    },
    noticeText: {
        flex: 1,
        fontSize: 10,
        color: '#92400e',
        lineHeight: 14,
    },
    statusBannerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderRadius: 12,
        borderWidth: 1.5,
        marginBottom: 10,
    },
    statusBannerText: {
        flex: 1,
        fontSize: 11,
        fontWeight: '700',
    },
});
