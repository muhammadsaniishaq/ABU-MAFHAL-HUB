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
    { id: '4', key: '9mobile', name: '9mobile / T2', color: '#006B3E', otpLength: 6 },
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
        if (!phone || phone.length < 11) {
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

            const blob = response.data.data;
            if (!blob) throw new Error("No session token received from network provider.");

            setSessionBlob(blob);
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setStep(2);
            Alert.alert("OTP Sent", response.data.message || `OTP has been sent to ${phone}`);
        } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to send OTP. Please check your details.");
        } finally {
            setLoadingStep1(false);
        }
    };

    // Step 2: Verify OTP
    const handleVerifyOtp = async () => {
        const net = getSelectedNetwork();
        if (!otp || otp.length < (net.otpLength || 4)) {
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
                throw new Error(response?.message || error?.message || "Invalid OTP entered.");
            }

            const newBlob = response.data.data;
            const fetchedBal = response.data.balance;

            if (newBlob) setSessionBlob(newBlob);
            if (fetchedBal !== undefined) setAirtimeBalance(parseFloat(fetchedBal));

            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setStep(3);
        } catch (err: any) {
            Alert.alert("Verification Failed", err.message || "Invalid OTP. Please restart from Step 1 if session expired.");
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
            Alert.alert("Validation", `Amount exceeds your airtime balance of ₦${airtimeBalance.toLocaleString()}`);
            return;
        }

        if (!sharePin || sharePin.length < 4) {
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

            const credited = response.data.credited || (numAmount * (getBuybackPct() / 100));

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
                    reference: response.data.transid || `AC_${Date.now()}`
                }
            });
        } catch (err: any) {
            Alert.alert("Conversion Failed", err.message || "Failed to convert airtime. Please restart from Step 1.");
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

            <KeyboardAvoidingView 
                behavior={Platform.OS === "ios" ? "padding" : "height"} 
                style={{ flex: 1 }}
            >
                {/* Curved Header */}
                <LinearGradient colors={['#060d21', '#0d1b3e']} style={s.headerContainer}>
                    <View style={s.headerTop}>
                        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
                            <Ionicons name="arrow-back" size={20} color="white" />
                        </TouchableOpacity>
                        <View style={{ alignItems: 'center' }}>
                            <Text style={s.headerTitle}>Airtime to Cash</Text>
                            {walletBalance !== null && (
                                <View style={s.balanceBadge}>
                                    <Ionicons name="wallet-outline" size={12} color="#f5a623" style={{ marginRight: 4 }} />
                                    <Text style={s.headerBalance}>
                                        ₦{walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <TouchableOpacity onPress={resetWizard} style={{ width: 32, alignItems: 'center' }}>
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
                    {/* KYC Tier Warning if not Tier 2 */}
                    {!isTier2 && (
                        <View style={s.kycWarningCard}>
                            <Ionicons name="shield-half-outline" size={22} color="#b45309" style={{ marginRight: 10 }} />
                            <View style={{ flex: 1 }}>
                                <Text style={s.kycWarningTitle}>Tier 2 Verification Required</Text>
                                <Text style={s.kycWarningText}>Airtime conversion credits your wallet directly. Please verify your BVN or NIN to proceed.</Text>
                                <TouchableOpacity onPress={() => router.push('/kyc')} style={s.kycBtn}>
                                    <Text style={s.kycBtnText}>Verify Identity Now</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* Rates Banner */}
                    <View style={s.ratesCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                            <Ionicons name="flash-outline" size={16} color="#2563eb" style={{ marginRight: 6 }} />
                            <Text style={s.ratesTitle}>Live Buyback Payout Rates</Text>
                        </View>
                        <View style={s.ratesRow}>
                            {NETWORKS_DATA.map((net) => {
                                const rateObj = rates.find((r: any) => r.plan_id === net.id || (r.network || '').toLowerCase().includes(net.key));
                                const pct = rateObj ? rateObj.buyback_pct : 80;
                                return (
                                    <View key={net.id} style={s.rateItem}>
                                        <Text style={[s.rateNetName, { color: net.color }]}>{net.name}</Text>
                                        <View style={[s.rateBadge, { backgroundColor: net.color + '15' }]}>
                                            <Text style={[s.ratePctText, { color: net.color }]}>{pct}% Payout</Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </View>

                    {/* Step Wizard Indicator */}
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
                        <Text style={s.wizardLabelText}>1. Details</Text>
                        <Text style={s.wizardLabelText}>2. Verify OTP</Text>
                        <Text style={s.wizardLabelText}>3. Convert</Text>
                    </View>

                    {/* STEP 1: Phone & Network Selection */}
                    {step === 1 && (
                        <View style={s.card}>
                            <Text style={s.cardTitle}>Step 1: Select Network & Phone</Text>
                            
                            <Text style={s.inputLabel}>Network</Text>
                            <View style={s.networkChipRow}>
                                {NETWORKS_DATA.map((net) => {
                                    const isSelected = networkId === net.id;
                                    return (
                                        <TouchableOpacity
                                            key={net.id}
                                            style={[
                                                s.networkChip,
                                                isSelected && { borderColor: net.color, backgroundColor: net.color + '15' }
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
                                            <Text style={[s.networkChipText, isSelected && { color: net.color, fontWeight: '800' }]}>
                                                {net.name}
                                            </Text>
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
                                    <TouchableOpacity onPress={() => setPhone(userPhone)} style={s.meBtn}>
                                        <Text style={s.meBtnText}>My Line</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            <TouchableOpacity
                                onPress={handleRequestOtp}
                                disabled={loadingStep1 || !isTier2}
                                style={[s.primaryBtn, (!isTier2 || loadingStep1) && s.btnDisabled]}
                                activeOpacity={0.85}
                            >
                                {loadingStep1 ? (
                                    <ActivityIndicator color="white" size="small" />
                                ) : (
                                    <>
                                        <Text style={s.primaryBtnText}>Send OTP to Line</Text>
                                        <Ionicons name="arrow-forward" size={18} color="white" style={{ marginLeft: 6 }} />
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* STEP 2: Verify OTP */}
                    {step === 2 && (
                        <View style={s.card}>
                            <Text style={s.cardTitle}>Step 2: Verify OTP</Text>
                            <Text style={s.cardSub}>
                                Enter the {getSelectedNetwork().otpLength}-digit security code sent to {phone}
                            </Text>

                            <Text style={s.inputLabel}>SMS OTP Code</Text>
                            <View style={s.inputContainer}>
                                <Ionicons name="keypad-outline" size={18} color="#64748b" style={{ marginRight: 8 }} />
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
                                <TouchableOpacity onPress={resetWizard} style={s.secondaryBtn}>
                                    <Text style={s.secondaryBtnText}>Back</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleVerifyOtp}
                                    disabled={loadingStep2}
                                    style={[s.primaryBtn, { flex: 2 }]}
                                    activeOpacity={0.85}
                                >
                                    {loadingStep2 ? (
                                        <ActivityIndicator color="white" size="small" />
                                    ) : (
                                        <>
                                            <Text style={s.primaryBtnText}>Verify OTP</Text>
                                            <Ionicons name="checkmark-circle-outline" size={18} color="white" style={{ marginLeft: 6 }} />
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* STEP 3: Amount & Share PIN */}
                    {step === 3 && (
                        <View style={s.card}>
                            <Text style={s.cardTitle}>Step 3: Finalise Conversion</Text>

                            {airtimeBalance !== null && (
                                <View style={s.airtimeBalBox}>
                                    <Text style={s.airtimeBalLabel}>Available Airtime Balance</Text>
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

                            {/* Live Calculation Preview */}
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
                                        <Text style={s.previewTotalLabel}>Wallet Credit Payout:</Text>
                                        <Text style={s.previewTotalVal}>₦{calculatedPayout.toLocaleString()}</Text>
                                    </View>
                                </View>
                            )}

                            <Text style={s.inputLabel}>4-Digit Share & Sell PIN</Text>
                            <View style={s.inputContainer}>
                                <Ionicons name="lock-closed-outline" size={18} color="#64748b" style={{ marginRight: 8 }} />
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
                                <TouchableOpacity onPress={resetWizard} style={s.secondaryBtn}>
                                    <Text style={s.secondaryBtnText}>Restart</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleFinaliseConversion}
                                    disabled={loadingStep3}
                                    style={[s.primaryBtn, { flex: 2, backgroundColor: '#16a34a' }]}
                                    activeOpacity={0.85}
                                >
                                    {loadingStep3 ? (
                                        <ActivityIndicator color="white" size="small" />
                                    ) : (
                                        <>
                                            <Text style={s.primaryBtnText}>Convert to Wallet Cash</Text>
                                            <Ionicons name="cash-outline" size={18} color="white" style={{ marginLeft: 6 }} />
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
        paddingBottom: 20,
        paddingHorizontal: 16,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
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
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        color: '#ffffff',
        fontSize: 17,
        fontWeight: '800',
    },
    balanceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(245, 166, 35, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        marginTop: 3,
    },
    headerBalance: {
        color: '#f5a623',
        fontSize: 11,
        fontWeight: '800',
    },
    scrollContainer: {
        padding: 16,
    },
    kycWarningCard: {
        flexDirection: 'row',
        backgroundColor: '#fffbeb',
        borderWidth: 1.5,
        borderColor: '#fde68a',
        borderRadius: 16,
        padding: 14,
        marginBottom: 16,
    },
    kycWarningTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#92400e',
        marginBottom: 2,
    },
    kycWarningText: {
        fontSize: 11,
        color: '#78350f',
        lineHeight: 15,
        marginBottom: 8,
    },
    kycBtn: {
        backgroundColor: '#d97706',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    kycBtnText: {
        color: '#ffffff',
        fontSize: 10.5,
        fontWeight: '800',
    },
    ratesCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 12,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        marginBottom: 16,
    },
    ratesTitle: {
        fontSize: 12,
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
        paddingVertical: 6,
        borderRadius: 10,
    },
    rateNetName: {
        fontSize: 10,
        fontWeight: '800',
        marginBottom: 2,
    },
    rateBadge: {
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 6,
    },
    ratePctText: {
        fontSize: 8.5,
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
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    wizardStepActive: {
        backgroundColor: '#2563eb',
    },
    wizardStepNum: {
        fontSize: 11,
        fontWeight: '800',
        color: '#64748b',
    },
    wizardStepNumActive: {
        color: '#ffffff',
    },
    wizardLine: {
        flex: 1,
        height: 2,
        backgroundColor: '#e2e8f0',
        marginHorizontal: 4,
    },
    wizardLineActive: {
        backgroundColor: '#2563eb',
    },
    wizardLabelsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    wizardLabelText: {
        fontSize: 9.5,
        fontWeight: '700',
        color: '#64748b',
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0d1b3e',
        marginBottom: 4,
    },
    cardSub: {
        fontSize: 11,
        color: '#64748b',
        marginBottom: 14,
    },
    inputLabel: {
        fontSize: 11.5,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 6,
        marginTop: 10,
    },
    networkChipRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 12,
    },
    networkChip: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    networkLogoBox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 3,
    },
    networkChipText: {
        fontSize: 9.5,
        fontWeight: '600',
        color: '#334155',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1.5,
        borderColor: '#cbd5e1',
        borderRadius: 14,
        paddingHorizontal: 12,
        height: 48,
        marginBottom: 14,
    },
    textInput: {
        flex: 1,
        fontSize: 14,
        fontWeight: '700',
        color: '#0d1b3e',
    },
    meBtn: {
        backgroundColor: '#e0e7ff',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    meBtnText: {
        color: '#3730a3',
        fontSize: 10,
        fontWeight: '800',
    },
    currencyPrefix: {
        fontSize: 16,
        fontWeight: '800',
        color: '#64748b',
        marginRight: 6,
    },
    primaryBtn: {
        backgroundColor: '#2563eb',
        borderRadius: 14,
        height: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 6,
    },
    primaryBtnText: {
        color: '#ffffff',
        fontSize: 13.5,
        fontWeight: '800',
    },
    secondaryBtn: {
        backgroundColor: '#f1f5f9',
        borderRadius: 14,
        height: 48,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 6,
    },
    secondaryBtnText: {
        color: '#475569',
        fontSize: 12,
        fontWeight: '700',
    },
    btnDisabled: {
        opacity: 0.5,
    },
    airtimeBalBox: {
        backgroundColor: '#f0fdf4',
        borderWidth: 1,
        borderColor: '#bbf7d0',
        borderRadius: 12,
        padding: 10,
        marginBottom: 12,
        alignItems: 'center',
    },
    airtimeBalLabel: {
        fontSize: 10,
        color: '#166534',
        fontWeight: '600',
    },
    airtimeBalVal: {
        fontSize: 16,
        fontWeight: '900',
        color: '#15803d',
        marginTop: 2,
    },
    previewCard: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 14,
    },
    previewRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    previewLabel: {
        fontSize: 11,
        color: '#64748b',
    },
    previewVal: {
        fontSize: 11,
        fontWeight: '700',
        color: '#0d1b3e',
    },
    previewDivider: {
        height: 1,
        backgroundColor: '#cbd5e1',
        marginVertical: 6,
    },
    previewTotalLabel: {
        fontSize: 12,
        fontWeight: '800',
        color: '#0d1b3e',
    },
    previewTotalVal: {
        fontSize: 14,
        fontWeight: '900',
        color: '#16a34a',
    },
});
