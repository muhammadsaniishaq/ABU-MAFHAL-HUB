import React, { useState, useEffect } from 'react';
import { 
    View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, 
    ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image, LayoutAnimation 
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../services/supabase';
import * as Haptics from 'expo-haptics';
import { createAppNotification } from '../../services/notificationsHelper';

const NETWORKS_DATA = [
    { id: '1', key: 'mtn', name: 'MTN', color: '#FFCC00', otpLength: 6 },
    { id: '2', key: 'airtel', name: 'Airtel', color: '#FF0000', otpLength: 4 },
    { id: '3', key: 'glo', name: 'Glo', color: '#0F6A37', otpLength: 6 },
    { id: '4', key: '9mobile', name: '9mobile', color: '#006B3E', otpLength: 6 },
    { id: '5', key: 'vitel', name: 'VITEL', color: '#6366F1', otpLength: 6 },
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
    const [step, setStep] = useState<1 | 2 | 3>(1);

    // Step 1 Form
    const [networkId, setNetworkId] = useState<string>('1');
    const [phone, setPhone] = useState<string>('');
    const [loadingStep1, setLoadingStep1] = useState<boolean>(false);

    // Step 2 Form (OTP)
    const [otp, setOtp] = useState<string>('');
    const [sessionBlob, setSessionBlob] = useState<string>('');
    const [airtimeBalance, setAirtimeBalance] = useState<number | null>(null);
    const [loadingStep2, setLoadingStep2] = useState<boolean>(false);

    // Step 3 Form (Amount & Share PIN)
    const [amount, setAmount] = useState<string>('');
    const [sharePin, setSharePin] = useState<string>('');
    const [loadingStep3, setLoadingStep3] = useState<boolean>(false);

    // Rates & Wallet Balance
    const [rates, setRates] = useState<any[]>([]);
    const [walletBalance, setWalletBalance] = useState<number | null>(null);
    const [isTier2, setIsTier2] = useState<boolean>(true);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            const { data: authData } = await supabase.auth.getUser();
            if (!authData?.user) return;
            setUserId(authData.user.id);

            // Fetch profile for KYC Tier
            const { data: prof } = await supabase.from('profiles').select('kyc_tier, bvn, nin, phone, balance').eq('id', authData.user.id).single();
            if (prof) {
                if (prof.phone) {
                    setUserPhone(prof.phone);
                    if (!phone) setPhone(prof.phone);
                }
                setWalletBalance(prof.balance || 0);
                const verified = (prof.kyc_tier && parseInt(String(prof.kyc_tier)) >= 2) || !!prof.bvn || !!prof.nin;
                setIsTier2(verified);
            }

            // Fetch Buyback Rates
            const { data: resData } = await supabase.functions.invoke('bills-payment', {
                body: { type: 'cash_rates' }
            });
            if (resData && resData.data) {
                setRates(resData.data);
            }
        } catch (e) {
            console.warn("Failed to fetch rates:", e);
        }
    };

    const getSelectedNetwork = () => {
        return NETWORKS_DATA.find(n => n.id === networkId) || NETWORKS_DATA[0];
    };

    const getBuybackPct = () => {
        const match = rates.find((r: any) => r.plan_id === networkId || (r.network || '').toLowerCase().includes(getSelectedNetwork().key));
        return match ? parseFloat(match.buyback_pct) : 80;
    };

    // Step 1: Request OTP
    const handleRequestOtp = async () => {
        if (!phone || phone.trim().length < 11) {
            Alert.alert("Validation", "Please enter a valid 11-digit phone number.");
            return;
        }

        setLoadingStep1(true);
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
                throw new Error(response?.message || error?.message || "Failed to send OTP.");
            }

            const blob = response?.data?.data;
            if (!blob) throw new Error(response?.data?.message || "Could not retrieve session token from telecom provider.");

            setSessionBlob(blob);
            if (Platform.OS !== 'web') LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setStep(2);
            Alert.alert("OTP Sent", response.data.message || `OTP has been sent to ${phone}`);
        } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to send OTP. Please check phone number.");
        } finally {
            setLoadingStep1(false);
        }
    };

    // Step 2: Verify OTP
    const handleVerifyOtp = async () => {
        const net = getSelectedNetwork();
        if (!otp || otp.trim().length < (net.otpLength || 4)) {
            Alert.alert("Validation", `Please enter the ${net.otpLength}-digit OTP sent to your phone.`);
            return;
        }

        setLoadingStep2(true);
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
                throw new Error(response?.message || error?.message || "Invalid OTP code entered.");
            }

            const newBlob = response?.data?.data;
            const fetchedBal = response?.data?.balance;

            if (newBlob) setSessionBlob(newBlob);
            if (fetchedBal !== undefined) setAirtimeBalance(parseFloat(fetchedBal));

            if (Platform.OS !== 'web') LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setStep(3);
        } catch (err: any) {
            Alert.alert("Verification Failed", err.message || "Invalid OTP code. Please try again.");
        } finally {
            setLoadingStep2(false);
        }
    };

    // Step 3: Finalise Conversion
    const handleFinaliseConversion = async () => {
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount < 50) {
            Alert.alert("Validation", "Minimum conversion amount is ₦50.");
            return;
        }

        if (airtimeBalance !== null && numAmount > airtimeBalance) {
            Alert.alert("Validation", `Amount exceeds your current line airtime balance of ₦${airtimeBalance.toLocaleString()}`);
            return;
        }

        if (!sharePin || sharePin.trim().length < 4) {
            Alert.alert("Validation", "Please enter your 4-digit Share & Sell PIN.");
            return;
        }

        setLoadingStep3(true);
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
                throw new Error(response?.message || error?.message || "Airtime conversion failed.");
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
            Alert.alert("Conversion Failed", err.message || "Failed to convert airtime to cash.");
        } finally {
            setLoadingStep3(false);
        }
    };

    const resetWizard = () => {
        setStep(1);
        setOtp('');
        setSessionBlob('');
        setAmount('');
        setSharePin('');
    };

    const currentBuybackPct = getBuybackPct();
    const calculatedPayout = amount ? parseFloat(amount) * (currentBuybackPct / 100) : 0;

    return (
        <View style={s.pageWrapper}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            <KeyboardAvoidingView 
                behavior={Platform.OS === "ios" ? "padding" : "height"} 
                style={{ flex: 1 }}
            >
                {/* Curved Modern Header */}
                <LinearGradient colors={['#060d21', '#0d1b3e', '#142258']} style={s.headerContainer}>
                    <View style={s.headerTop}>
                        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
                            <Ionicons name="arrow-back" size={20} color="white" />
                        </TouchableOpacity>
                        <View style={{ alignItems: 'center' }}>
                            <Text style={s.headerTitle}>Airtime ➔ Cash</Text>
                            {walletBalance !== null && (
                                <View style={s.balanceBadge}>
                                    <Ionicons name="wallet-outline" size={12} color="#f5a623" style={{ marginRight: 4 }} />
                                    <Text style={s.headerBalance}>
                                        ₦{walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <TouchableOpacity onPress={resetWizard} style={s.refreshBtn} activeOpacity={0.7}>
                            <Ionicons name="refresh" size={18} color="#94a3b8" />
                        </TouchableOpacity>
                    </View>
                </LinearGradient>

                <ScrollView 
                    style={{ flex: 1 }} 
                    contentContainerStyle={s.scrollContainer}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Live Payout Rates Widget */}
                    <View style={s.ratesCard}>
                        <View style={s.ratesHeader}>
                            <View style={s.ratesIconBox}>
                                <Ionicons name="flash-outline" size={16} color="#2563eb" />
                            </View>
                            <Text style={s.ratesTitle}>Live Payout Rates (Buyback %)</Text>
                        </View>
                        <View style={s.ratesRow}>
                            {NETWORKS_DATA.map((net) => {
                                const rateObj = rates.find((r: any) => r.plan_id === net.id || (r.network || '').toLowerCase().includes(net.key));
                                const pct = rateObj ? rateObj.buyback_pct : 80;
                                return (
                                    <View key={net.id} style={s.rateItem}>
                                        <Text style={[s.rateNetName, { color: net.color }]}>{net.name}</Text>
                                        <View style={[s.rateBadge, { backgroundColor: net.color + '20' }]}>
                                            <Text style={[s.ratePctText, { color: net.color }]}>{pct}%</Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </View>

                    {/* Step Wizard Progress Bar */}
                    <View style={s.wizardIndicatorContainer}>
                        <View style={[s.wizardStepCircle, step >= 1 && s.wizardStepActive]}>
                            <Text style={[s.wizardStepNum, step >= 1 && s.wizardStepNumActive]}>1</Text>
                        </View>
                        <View style={[s.wizardLine, step >= 2 && s.wizardLineActive]} />
                        <View style={[s.wizardStepCircle, step >= 2 && s.wizardStepActive]}>
                            <Text style={[s.wizardStepNum, step >= 2 && s.wizardStepNumActive]}>2</Text>
                        </View>
                        <View style={[s.wizardLine, step >= 3 && s.wizardLineActive]} />
                        <View style={[s.wizardStepCircle, step >= 3 && s.wizardStepActive]}>
                            <Text style={[s.wizardStepNum, step >= 3 && s.wizardStepNumActive]}>3</Text>
                        </View>
                    </View>
                    <View style={s.wizardLabelsRow}>
                        <Text style={[s.wizardLabelText, step >= 1 && { color: '#0d1b3e', fontWeight: '800' }]}>1. Network & Phone</Text>
                        <Text style={[s.wizardLabelText, step >= 2 && { color: '#0d1b3e', fontWeight: '800' }]}>2. SMS OTP</Text>
                        <Text style={[s.wizardLabelText, step >= 3 && { color: '#0d1b3e', fontWeight: '800' }]}>3. Payout PIN</Text>
                    </View>

                    {/* STEP 1: Phone & 5-Column Network Selection */}
                    {step === 1 && (
                        <View style={s.card}>
                            <View style={s.cardHeaderRow}>
                                <Ionicons name="phone-portrait-outline" size={18} color="#2563eb" style={{ marginRight: 6 }} />
                                <Text style={s.cardTitle}>Step 1: Network & Phone Number</Text>
                            </View>
                            
                            <Text style={s.inputLabel}>Select Network (5 Available)</Text>
                            {/* 5-Column Chip Row Layout */}
                            <View style={s.networkChipRow}>
                                {NETWORKS_DATA.map((net) => {
                                    const isSelected = networkId === net.id;
                                    return (
                                        <TouchableOpacity
                                            key={net.id}
                                            style={[
                                                s.networkChip,
                                                isSelected && { borderColor: net.color, backgroundColor: net.color + '15', borderWidth: 2 }
                                            ]}
                                            onPress={() => setNetworkId(net.id)}
                                            activeOpacity={0.8}
                                        >
                                            <View style={s.networkLogoBox}>
                                                <Image 
                                                    source={NETWORK_LOGOS[net.key]} 
                                                    style={{ width: '100%', height: '100%' }}
                                                    resizeMode="contain"
                                                />
                                            </View>
                                            <Text style={[s.networkChipText, isSelected && { color: net.color, fontWeight: '800' }]} numberOfLines={1}>
                                                {net.name}
                                            </Text>
                                            {isSelected && (
                                                <View style={[s.chipDot, { backgroundColor: net.color }]} />
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={s.inputLabel}>Phone Number holding the Airtime</Text>
                            <View style={s.inputContainer}>
                                <Ionicons name="call-outline" size={18} color="#64748b" style={{ marginRight: 8 }} />
                                <TextInput
                                    value={phone}
                                    onChangeText={setPhone}
                                    placeholder="08012345678"
                                    placeholderTextColor="#94a3b8"
                                    keyboardType="phone-pad"
                                    maxLength={11}
                                    style={s.textInput}
                                />
                                {userPhone && phone !== userPhone && (
                                    <TouchableOpacity onPress={() => setPhone(userPhone)} style={s.meBtn} activeOpacity={0.7}>
                                        <Text style={s.meBtnText}>My Line</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* 100% ALWAYS CLICKABLE SEND OTP BUTTON */}
                            <TouchableOpacity
                                onPress={handleRequestOtp}
                                disabled={loadingStep1}
                                style={s.primaryBtn}
                                activeOpacity={0.8}
                            >
                                {loadingStep1 ? (
                                    <ActivityIndicator color="white" size="small" />
                                ) : (
                                    <>
                                        <Text style={s.primaryBtnText}>Send OTP to Line</Text>
                                        <Ionicons name="arrow-forward-circle" size={20} color="white" style={{ marginLeft: 8 }} />
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* STEP 2: Enter & Verify OTP */}
                    {step === 2 && (
                        <View style={s.card}>
                            <View style={s.cardHeaderRow}>
                                <Ionicons name="keypad-outline" size={18} color="#2563eb" style={{ marginRight: 6 }} />
                                <Text style={s.cardTitle}>Step 2: Enter SMS OTP Code</Text>
                            </View>
                            <Text style={s.cardSub}>
                                Enter the {getSelectedNetwork().otpLength}-digit security code sent via SMS to {phone}
                            </Text>

                            <Text style={s.inputLabel}>SMS OTP Security Code</Text>
                            <View style={s.inputContainer}>
                                <Ionicons name="lock-open-outline" size={18} color="#64748b" style={{ marginRight: 8 }} />
                                <TextInput
                                    value={otp}
                                    onChangeText={setOtp}
                                    placeholder={`Enter ${getSelectedNetwork().otpLength}-digit OTP`}
                                    placeholderTextColor="#94a3b8"
                                    keyboardType="number-pad"
                                    maxLength={getSelectedNetwork().otpLength}
                                    style={[s.textInput, { letterSpacing: 4, fontWeight: '800' }]}
                                />
                            </View>

                            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                                <TouchableOpacity onPress={resetWizard} style={s.secondaryBtn} activeOpacity={0.7}>
                                    <Text style={s.secondaryBtnText}>Back</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleVerifyOtp}
                                    disabled={loadingStep2}
                                    style={[s.primaryBtn, { flex: 2 }]}
                                    activeOpacity={0.8}
                                >
                                    {loadingStep2 ? (
                                        <ActivityIndicator color="white" size="small" />
                                    ) : (
                                        <>
                                            <Text style={s.primaryBtnText}>Verify OTP Code</Text>
                                            <Ionicons name="checkmark-circle" size={20} color="white" style={{ marginLeft: 6 }} />
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* STEP 3: Amount & Share PIN */}
                    {step === 3 && (
                        <View style={s.card}>
                            <View style={s.cardHeaderRow}>
                                <Ionicons name="cash-outline" size={18} color="#16a34a" style={{ marginRight: 6 }} />
                                <Text style={s.cardTitle}>Step 3: Conversion & Payout</Text>
                            </View>

                            {airtimeBalance !== null && (
                                <View style={s.airtimeBalBox}>
                                    <Text style={s.airtimeBalLabel}>Available Airtime Balance on Line</Text>
                                    <Text style={s.airtimeBalVal}>₦{airtimeBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                                </View>
                            )}

                            <Text style={s.inputLabel}>Airtime Amount to Convert (₦)</Text>
                            <View style={s.inputContainer}>
                                <Text style={s.currencyPrefix}>₦</Text>
                                <TextInput
                                    value={amount}
                                    onChangeText={setAmount}
                                    placeholder="1000"
                                    placeholderTextColor="#94a3b8"
                                    keyboardType="number-pad"
                                    style={s.textInput}
                                />
                            </View>

                            {/* Live Calculation Preview Card */}
                            {parseFloat(amount) > 0 && (
                                <View style={s.previewCard}>
                                    <View style={s.previewRow}>
                                        <Text style={s.previewLabel}>Airtime Value:</Text>
                                        <Text style={s.previewVal}>₦{parseFloat(amount).toLocaleString()}</Text>
                                    </View>
                                    <View style={s.previewRow}>
                                        <Text style={s.previewLabel}>Payout Rate ({currentBuybackPct}%):</Text>
                                        <Text style={[s.previewVal, { color: '#16a34a' }]}>+₦{calculatedPayout.toLocaleString()}</Text>
                                    </View>
                                    <View style={s.previewDivider} />
                                    <View style={s.previewRow}>
                                        <Text style={s.previewTotalLabel}>Wallet Cash Credit:</Text>
                                        <Text style={s.previewTotalVal}>₦{calculatedPayout.toLocaleString()}</Text>
                                    </View>
                                </View>
                            )}

                            <Text style={s.inputLabel}>4-Digit Share & Sell PIN</Text>
                            <View style={s.inputContainer}>
                                <Ionicons name="shield-checkmark-outline" size={18} color="#64748b" style={{ marginRight: 8 }} />
                                <TextInput
                                    value={sharePin}
                                    onChangeText={setSharePin}
                                    placeholder="1234"
                                    placeholderTextColor="#94a3b8"
                                    secureTextEntry
                                    keyboardType="number-pad"
                                    maxLength={4}
                                    style={[s.textInput, { letterSpacing: 4 }]}
                                />
                            </View>

                            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                                <TouchableOpacity onPress={resetWizard} style={s.secondaryBtn} activeOpacity={0.7}>
                                    <Text style={s.secondaryBtnText}>Restart</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleFinaliseConversion}
                                    disabled={loadingStep3}
                                    style={[s.primaryBtn, { flex: 2, backgroundColor: '#16a34a' }]}
                                    activeOpacity={0.8}
                                >
                                    {loadingStep3 ? (
                                        <ActivityIndicator color="white" size="small" />
                                    ) : (
                                        <>
                                            <Text style={s.primaryBtnText}>Credit Wallet Now</Text>
                                            <Ionicons name="wallet-outline" size={20} color="white" style={{ marginLeft: 6 }} />
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
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
        paddingTop: Platform.OS === 'ios' ? 54 : 40,
        paddingBottom: 22,
        paddingHorizontal: 16,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        shadowColor: '#060d21',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 5,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    refreshBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '800',
    },
    balanceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(245, 166, 35, 0.2)',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 12,
        marginTop: 4,
        borderWidth: 1,
        borderColor: 'rgba(245, 166, 35, 0.3)',
    },
    headerBalance: {
        color: '#f5a623',
        fontSize: 11.5,
        fontWeight: '800',
    },
    scrollContainer: {
        padding: 16,
    },
    ratesCard: {
        backgroundColor: '#ffffff',
        borderRadius: 18,
        padding: 14,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        marginBottom: 18,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    ratesHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    ratesIconBox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#eff6ff',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    ratesTitle: {
        fontSize: 12.5,
        fontWeight: '800',
        color: '#0d1b3e',
    },
    ratesRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 4,
    },
    rateItem: {
        flex: 1,
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    rateNetName: {
        fontSize: 10,
        fontWeight: '800',
        marginBottom: 3,
    },
    rateBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    ratePctText: {
        fontSize: 9,
        fontWeight: '800',
    },
    wizardIndicatorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
        paddingHorizontal: 30,
    },
    wizardStepCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    wizardStepActive: {
        backgroundColor: '#2563eb',
    },
    wizardStepNum: {
        fontSize: 12,
        fontWeight: '800',
        color: '#64748b',
    },
    wizardStepNumActive: {
        color: '#ffffff',
    },
    wizardLine: {
        flex: 1,
        height: 3,
        backgroundColor: '#e2e8f0',
        marginHorizontal: 4,
        borderRadius: 2,
    },
    wizardLineActive: {
        backgroundColor: '#2563eb',
    },
    wizardLabelsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
        marginBottom: 18,
    },
    wizardLabelText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#94a3b8',
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 18,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        marginBottom: 18,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    cardHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    cardTitle: {
        fontSize: 14.5,
        fontWeight: '800',
        color: '#0d1b3e',
    },
    cardSub: {
        fontSize: 11.5,
        color: '#64748b',
        marginBottom: 14,
        lineHeight: 16,
    },
    inputLabel: {
        fontSize: 11.5,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 8,
        marginTop: 8,
    },
    // 5-Column Chip Row Layout
    networkChipRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 4,
        marginBottom: 14,
        width: '100%',
    },
    networkChip: {
        flex: 1,
        paddingVertical: 9,
        paddingHorizontal: 2,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    networkLogoBox: {
        width: 26,
        height: 26,
        borderRadius: 13,
        overflow: 'hidden',
        marginBottom: 4,
        backgroundColor: '#f8fafc',
    },
    networkChipText: {
        fontSize: 9.5,
        fontWeight: '600',
        color: '#334155',
        textAlign: 'center',
    },
    chipDot: {
        position: 'absolute',
        top: -3,
        right: -3,
        width: 10,
        height: 10,
        borderRadius: 5,
        borderWidth: 1.5,
        borderColor: '#ffffff',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1.5,
        borderColor: '#cbd5e1',
        borderRadius: 14,
        paddingHorizontal: 12,
        height: 50,
        marginBottom: 16,
    },
    textInput: {
        flex: 1,
        fontSize: 14.5,
        fontWeight: '700',
        color: '#0d1b3e',
    },
    meBtn: {
        backgroundColor: '#e0e7ff',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
    },
    meBtnText: {
        color: '#3730a3',
        fontSize: 10.5,
        fontWeight: '800',
    },
    currencyPrefix: {
        fontSize: 17,
        fontWeight: '800',
        color: '#64748b',
        marginRight: 6,
    },
    primaryBtn: {
        backgroundColor: '#2563eb',
        borderRadius: 16,
        height: 50,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 6,
        shadowColor: '#2563eb',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryBtnText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '800',
    },
    secondaryBtn: {
        backgroundColor: '#f1f5f9',
        borderRadius: 16,
        height: 50,
        paddingHorizontal: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 6,
    },
    secondaryBtnText: {
        color: '#475569',
        fontSize: 12.5,
        fontWeight: '700',
    },
    airtimeBalBox: {
        backgroundColor: '#f0fdf4',
        borderWidth: 1.5,
        borderColor: '#bbf7d0',
        borderRadius: 14,
        padding: 12,
        marginBottom: 14,
        alignItems: 'center',
    },
    airtimeBalLabel: {
        fontSize: 10.5,
        color: '#166534',
        fontWeight: '700',
    },
    airtimeBalVal: {
        fontSize: 18,
        fontWeight: '900',
        color: '#15803d',
        marginTop: 2,
    },
    previewCard: {
        backgroundColor: '#f8fafc',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        marginBottom: 16,
    },
    previewRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    previewLabel: {
        fontSize: 11.5,
        color: '#64748b',
    },
    previewVal: {
        fontSize: 11.5,
        fontWeight: '700',
        color: '#0d1b3e',
    },
    previewDivider: {
        height: 1,
        backgroundColor: '#cbd5e1',
        marginVertical: 8,
    },
    previewTotalLabel: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0d1b3e',
    },
    previewTotalVal: {
        fontSize: 15,
        fontWeight: '900',
        color: '#16a34a',
    },
});
