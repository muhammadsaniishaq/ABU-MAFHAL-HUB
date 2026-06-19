import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, Clipboard, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../services/supabase';
import PaystackPayment from '../components/PaystackPayment';
import { api } from '../services/api';

// Main Content Component
function FundWalletContent() {
    // State
    const [method, setMethod] = useState<'transfer' | 'card'>('transfer');
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [virtualAccount, setVirtualAccount] = useState<any>(null);
    const [generating, setGenerating] = useState(false);
    const [missingBvn, setMissingBvn] = useState(false);
    const [manualBvn, setManualBvn] = useState('');
    const [userEmail, setUserEmail] = useState('user@example.com');
    
    // Custom Paystack State
    const [showPaystack, setShowPaystack] = useState(false);

    const router = useRouter();

    useEffect(() => {
        fetchVirtualAccount();
    }, []);

    const fetchVirtualAccount = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setUserEmail(user.email || 'user@example.com');
            const { data } = await supabase
                .from('virtual_accounts')
                .select('id, user_id, provider, bank_name, account_number, account_name, currency')
                .eq('user_id', user.id)
                .maybeSingle();
            setVirtualAccount(data);
        }
    };

    const handleGenerateAccount = async () => {
        if (missingBvn && manualBvn.length < 11) {
             Alert.alert("Invalid BVN", "Please enter a valid 11-digit BVN.");
             return;
        }

        setGenerating(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            
            const { data: profile, error: profileError } = await supabase.from('profiles').select('full_name, kyc_tier').eq('id', user.id).single();
            
            if (profileError || !profile) {
                Alert.alert("Error", "Could not fetch user profile details.");
                return;
            }

            if (profile.kyc_tier < 2) {
                Alert.alert("Upgrade Required", "Please complete Tier 2 (Identity) Verification to get an account number.", [
                    { text: "Go to KYC", onPress: () => router.push('/kyc') },
                    { text: "Cancel", style: "cancel" }
                ]);
                return;
            }

            const { data: newAccount, error } = await supabase.functions.invoke('create-virtual-account', {
                body: { 
                    userId: user.id, 
                    bvn: missingBvn ? manualBvn : undefined 
                }
            });

            if (error) throw new Error(error.message || "Function Invocation Failed");
            if (newAccount && newAccount.error) throw new Error(newAccount.error);

            setMissingBvn(false);
            setManualBvn('');
            await fetchVirtualAccount(); 
            Alert.alert("Success", "Virtual Account Generated Successfully!");

        } catch (e: any) {
            if (e.message === "BVN Required" || e.message?.startsWith("BVN Required")) {
                 setMissingBvn(true);
                 Alert.alert("BVN Required", "To generate a dedicated account number, our banking partner requires your BVN for verification. Please enter it below.");
            } else {
                 Alert.alert("Error", e.message);
            }
        } finally {
            setGenerating(false);
        }
    };

    const copyToClipboard = (text: string) => {
        Clipboard.setString(text);
        Alert.alert("Copied", "Account number copied to clipboard");
    };

    const handleSuccessCallback = async (res: any) => {
        // GUARD: Ensure strict success status from Paystack
        if (res.status !== 'success') {
             Alert.alert("Payment Failed", "Transaction was not completed successfully.");
             return;
        }

        setLoading(true);
        const depositAmount = parseFloat(amount);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user.id).single();
            const currentBalance = parseFloat(profile?.balance?.toString() || '0');

            // Record Transaction
            const { error: txError } = await supabase
                .from('transactions')
                .insert({
                    user_id: user.id,
                    type: 'deposit',
                    amount: depositAmount,
                    status: 'success',
                    description: `Wallet Top-up via Card (Paystack)`,
                    reference: res.reference || `PAY-${Date.now()}` // Adjust ref field if needed
                });

            if (txError) throw txError;

            // Update Balance
            const { error: balanceError } = await supabase
                .from('profiles')
                .update({ balance: currentBalance + depositAmount })
                .eq('id', user.id);

            if (balanceError) throw balanceError;

            Alert.alert("Success", "Wallet funded successfully!");
            router.replace('/dashboard');
        } catch (error: any) {
            Alert.alert("Funding Failed", error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCardPayment = () => {
        if (!amount) return;
        const depositAmount = parseFloat(amount);
        if (isNaN(depositAmount) || depositAmount <= 0) {
             Alert.alert("Invalid Amount", "Please enter a valid amount.");
             return;
        }
        
        // Open Custom Paystack Modal
        setShowPaystack(true);
    };

    return (
        <View style={{ flex: 1, backgroundColor: 'white' }}>
            <Stack.Screen options={{ title: 'Fund Wallet', headerTintColor: '#0056D2' }} />
            <StatusBar style="dark" />

            <ScrollView contentContainerStyle={{ padding: 24 }}>
                <View style={{ flexDirection: 'row', backgroundColor: '#F3F4F6', padding: 4, borderRadius: 12, marginBottom: 32 }}>
                    <TouchableOpacity
                        style={{ flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8, backgroundColor: method === 'transfer' ? 'white' : 'transparent', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: method === 'transfer' ? 0.05 : 0, shadowRadius: 1, elevation: method === 'transfer' ? 2 : 0 }}
                        onPress={() => setMethod('transfer')}
                    >
                        <Text style={{ fontWeight: 'bold', color: method === 'transfer' ? '#0056D2' : '#6B7280' }}>Bank Transfer</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={{ flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8, backgroundColor: method === 'card' ? 'white' : 'transparent', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: method === 'card' ? 0.05 : 0, shadowRadius: 1, elevation: method === 'card' ? 2 : 0 }}
                        onPress={() => setMethod('card')}
                    >
                        <Text style={{ fontWeight: 'bold', color: method === 'card' ? '#0056D2' : '#6B7280' }}>Card Payment</Text>
                    </TouchableOpacity>
                </View>

                {method === 'transfer' ? (
                    <View>
                        <View style={{ backgroundColor: '#EFF6FF', padding: 16, borderRadius: 12, marginBottom: 24, borderWidth: 1, borderColor: '#DBEAFE' }}>
                            <Text style={{ color: '#0056D2', fontWeight: '500', marginBottom: 8 }}>Automated Bank Transfer</Text>
                            <Text style={{ color: '#4B5563', fontSize: 14, lineHeight: 20 }}>
                                Transfer to the account number below. Your wallet will be funded automatically instantly.
                            </Text>
                        </View>

                        {virtualAccount ? (
                            <View style={{ backgroundColor: 'white', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <Text style={{ fontWeight: 'bold', color: '#6B7280', textTransform: 'capitalize' }}>{virtualAccount.bank_name}</Text>
                                    <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}>
                                        <Text style={{ color: '#15803D', fontSize: 12, fontWeight: 'bold' }}>Active</Text>
                                    </View>
                                </View>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#1F2937' }}>{virtualAccount.account_number}</Text>
                                    <TouchableOpacity onPress={() => copyToClipboard(virtualAccount.account_number)}>
                                        <Ionicons name="copy-outline" size={24} color="#0056D2" />
                                    </TouchableOpacity>
                                </View>
                                <Text style={{ color: '#6B7280', fontSize: 14, marginTop: 4 }}>{virtualAccount.account_name}</Text>
                            </View>
                        ) : (
                            <View style={{ alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#D1D5DB', borderStyle: 'dashed' }}>
                                <Ionicons name="wallet-outline" size={48} color="#9CA3AF" />
                                <Text style={{ color: '#6B7280', fontWeight: '500', marginTop: 16, textAlign: 'center' }}>No Virtual Account Assigned</Text>
                                <Text style={{ color: '#9CA3AF', fontSize: 12, textAlign: 'center', marginTop: 4, marginBottom: 24 }}>
                                    Get your dedicated account number to receive bank transfers instantly.
                                </Text>
                                
                                {missingBvn && (
                                    <View style={{ width: '100%', marginBottom: 16 }}>
                                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#EF4444', marginBottom: 8 }}>BVN Required</Text>
                                        <TextInput 
                                            value={manualBvn}
                                            onChangeText={setManualBvn}
                                            placeholder="Enter 11-Digit BVN"
                                            keyboardType="number-pad"
                                            maxLength={11}
                                            style={{ backgroundColor: 'white', borderWidth: 1, borderColor: '#FECACA', textAlign: 'center', padding: 12, borderRadius: 8, fontWeight: 'bold', fontSize: 18 }}
                                        />
                                    </View>
                                )}

                                <TouchableOpacity 
                                    onPress={handleGenerateAccount} 
                                    disabled={generating}
                                    style={{ backgroundColor: '#0056D2', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 9999, flexDirection: 'row', alignItems: 'center' }}
                                >
                                    {generating ? <ActivityIndicator color="white" size="small" /> : (
                                        <>
                                            <Ionicons name="add-circle" size={20} color="white" />
                                            <Text style={{ color: 'white', fontWeight: 'bold', marginLeft: 8 }}>
                                                {missingBvn ? 'Submit BVN & Generate' : 'Generate Account'}
                                            </Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                ) : (
                    <View>
                        <View style={{ backgroundColor: '#EFF6FF', padding: 16, borderRadius: 12, marginBottom: 24, borderWidth: 1, borderColor: '#DBEAFE' }}>
                            <Text style={{ color: '#0056D2', fontWeight: '500', marginBottom: 8 }}>Card Payment</Text>
                            <Text style={{ color: '#4B5563', fontSize: 14, lineHeight: 20 }}>
                                Fund your wallet using your ATM card via Paystack. A 1.5% charge applies.
                            </Text>
                        </View>

                        <Text style={{ color: '#1F2937', fontWeight: 'bold', marginBottom: 16 }}>Amount</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, paddingHorizontal: 16, height: 64, backgroundColor: '#F9FAFB', marginBottom: 32 }}>
                            <Text style={{ color: '#6B7280', fontSize: 20, fontWeight: 'bold', marginRight: 8 }}>₦</Text>
                            <TextInput
                                style={{ flex: 1, fontSize: 24, fontWeight: 'bold', color: '#1F2937' }}
                                keyboardType="number-pad"
                                value={amount}
                                onChangeText={setAmount}
                                placeholder="0.00"
                            />
                        </View>

                        <TouchableOpacity
                            style={{ height: 56, borderRadius: 9999, alignItems: 'center', justifyContent: 'center', marginBottom: 32, backgroundColor: amount && !loading ? '#0056D2' : '#D1D5DB' }}
                            onPress={handleCardPayment}
                            disabled={!amount || loading}
                        >
                            {loading ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18 }}>Pay with Paystack</Text>}
                        </TouchableOpacity>

                        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
                            <Ionicons name="lock-closed" size={16} color="#6B7280" />
                            <Text style={{ color: '#6B7280', fontSize: 14, marginLeft: 8 }}>Secured by Paystack</Text>
                        </View>
                    </View>
                )}
            </ScrollView>

            <PaystackPayment 
                visible={showPaystack}
                amount={parseFloat(amount || '0')}
                email={userEmail}
                publicKey={process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY || ''}
                onSuccess={handleSuccessCallback}
                onCancel={() => Alert.alert("Cancelled", "Transaction cancelled")}
                onClose={() => setShowPaystack(false)}
            />
        </View>
    );
}

export default function FundWalletScreen() {
    return <FundWalletContent />;
}
