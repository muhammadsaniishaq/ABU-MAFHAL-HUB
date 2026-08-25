import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../../services/supabase';
import { api } from '../../../services/api';
import { verificationHistory } from '../../../services/verificationHistory';

export default function BVNRetrievalScreen() {
    const insets = useSafeAreaInsets();
    const [method, setMethod] = useState<'phone' | 'crm'>('phone');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [fullName, setFullName] = useState('');
    const [agentCode, setAgentCode] = useState('');
    const [ticketId, setTicketId] = useState('');
    const [bmsTicket, setBmsTicket] = useState('');
    const [loading, setLoading] = useState(false);
    const [userBalance, setUserBalance] = useState<number | null>(null);
    const [result, setResult] = useState<any>(null);

    const fetchWalletBalance = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from('profiles').select('balance').eq('id', user.id).single();
                if (data) setUserBalance(Number(data.balance));
            }
        } catch (e) {
            console.warn('Failed to load wallet balance', e);
        }
    };

    useEffect(() => {
        fetchWalletBalance();
    }, []);

    const showAlert = (title: string, message: string, type: 'error' | 'success' = 'error') => {
        if (Platform.OS === 'web') alert(`${title}\n\n${message}`);
        else Alert.alert(title, message);
    };

    const handleRetrieve = async () => {
        const cleanPhone = phoneNumber.trim().replace(/\D/g, '');
        if (method === 'phone') {
            if (!cleanPhone || cleanPhone.length < 10) {
                showAlert("Invalid Phone Number", "Please enter a valid 11-digit phone number.");
                return;
            }
            if (!fullName.trim()) {
                showAlert("Full Name Required", "Please enter the full name of the BVN holder.");
                return;
            }
        } else {
            if (!ticketId.trim() || !agentCode.trim()) {
                showAlert("Credentials Required", "Please enter both Agent Code and Ticket ID for CRM retrieval.");
                return;
            }
        }

        if (userBalance !== null && userBalance < 900) {
            showAlert("Insufficient Balance", "Your account balance is insufficient (₦900 required) for BVN retrieval. Please fund your wallet.");
            return;
        }

        setLoading(true);
        setResult(null);

        try {
            const extraData = method === 'phone' ? {
                service_code: '630',
                phone_number: cleanPhone,
                full_name: fullName.trim(),
                reference: `REF-RET-${Date.now()}`
            } : {
                service_code: '631',
                agent_code: agentCode.trim(),
                ticket_id: ticketId.trim(),
                bms_ticket: bmsTicket.trim(),
                reference: `REF-CRM-${Date.now()}`
            };

            const res = await api.identity.retrieveBVN(cleanPhone, 'bvn_retrieval', extraData);

            if (res && res.isValid && res.data) {
                const rawData = res.data.data || res.data;
                setResult(rawData);
                showAlert("Retrieval Successful", "BVN details recovered successfully!", "success");

                await verificationHistory.save({
                    service_category: 'bvn',
                    service_type: method === 'phone' ? 'bvn_retrieval_phone' : 'bvn_retrieval_crm',
                    search_number: cleanPhone || ticketId,
                    holder_name: fullName.trim() || rawData.fullName || 'BVN Holder',
                    details: rawData,
                });
                fetchWalletBalance();
            } else {
                showAlert("Retrieval Failed", res?.message || "No BVN found matching the provided details.");
            }
        } catch (e: any) {
            showAlert("Error", e.message || "An error occurred while connecting to server.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            <LinearGradient
                colors={['#050B14', '#0B163A']}
                style={[styles.headerGradient, { paddingTop: Math.max(insets.top, 20) + 8, paddingBottom: 24 }]}
            >
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
                        <Ionicons name="chevron-back" size={20} color="#ffffff" />
                    </TouchableOpacity>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>RECOVERY SUITE</Text>
                    </View>
                </View>
                <Text style={styles.titleText}>BVN Retrieval</Text>
                <Text style={styles.subText}>Recover lost or forgotten BVN via Phone or CRM Ticket</Text>
            </LinearGradient>

            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Method Selector Tabs */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tab, method === 'phone' && styles.activeTab]}
                        onPress={() => setMethod('phone')}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="call" size={16} color={method === 'phone' ? '#ffffff' : '#64748b'} style={{ marginRight: 6 }} />
                        <Text style={[styles.tabText, method === 'phone' && styles.activeTabText]}>Retrieval by Phone (630)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, method === 'crm' && styles.activeTab]}
                        onPress={() => setMethod('crm')}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="desktop" size={16} color={method === 'crm' ? '#ffffff' : '#64748b'} style={{ marginRight: 6 }} />
                        <Text style={[styles.tabText, method === 'crm' && styles.activeTabText]}>CRM Ticket (631)</Text>
                    </TouchableOpacity>
                </View>

                {/* Form Card */}
                <View style={styles.formCard}>
                    {method === 'phone' ? (
                        <>
                            <Text style={styles.inputLabel}>PHONE NUMBER (11 Digits)</Text>
                            <View style={styles.inputRow}>
                                <Ionicons name="call-outline" size={18} color="#64748b" style={{ marginRight: 8 }} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Example: 08012345678"
                                    placeholderTextColor="#94a3b8"
                                    keyboardType="numeric"
                                    maxLength={11}
                                    value={phoneNumber}
                                    onChangeText={setPhoneNumber}
                                />
                            </View>

                            <Text style={[styles.inputLabel, { marginTop: 14 }]}>FULL NAME (BVN Holder)</Text>
                            <View style={styles.inputRow}>
                                <Ionicons name="person-outline" size={18} color="#64748b" style={{ marginRight: 8 }} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Example: Ibrahim Abubakar"
                                    placeholderTextColor="#94a3b8"
                                    value={fullName}
                                    onChangeText={setFullName}
                                    autoCapitalize="characters"
                                />
                            </View>
                        </>
                    ) : (
                        <>
                            <Text style={styles.inputLabel}>AGENT CODE</Text>
                            <View style={styles.inputRow}>
                                <Ionicons name="person-circle-outline" size={18} color="#64748b" style={{ marginRight: 8 }} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Agent ID"
                                    placeholderTextColor="#94a3b8"
                                    value={agentCode}
                                    onChangeText={setAgentCode}
                                />
                            </View>

                            <Text style={[styles.inputLabel, { marginTop: 14 }]}>TICKET ID</Text>
                            <View style={styles.inputRow}>
                                <Ionicons name="ticket-outline" size={18} color="#64748b" style={{ marginRight: 8 }} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Support Ticket ID"
                                    placeholderTextColor="#94a3b8"
                                    value={ticketId}
                                    onChangeText={setTicketId}
                                />
                            </View>

                            <Text style={[styles.inputLabel, { marginTop: 14 }]}>BMS TICKET (OPTIONAL)</Text>
                            <View style={styles.inputRow}>
                                <Ionicons name="document-outline" size={18} color="#64748b" style={{ marginRight: 8 }} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="BMS Ticket Number"
                                    placeholderTextColor="#94a3b8"
                                    value={bmsTicket}
                                    onChangeText={setBmsTicket}
                                />
                            </View>
                        </>
                    )}

                    <View style={styles.costRow}>
                        <Text style={styles.costLabel}>Service Fee:</Text>
                        <Text style={styles.costVal}>₦900</Text>
                    </View>

                    <TouchableOpacity
                        style={[styles.btn, loading && { opacity: 0.7 }]}
                        onPress={handleRetrieve}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <ActivityIndicator color="#ffffff" />
                        ) : (
                            <>
                                <Ionicons name="search" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                                <Text style={styles.btnText}>Retrieve BVN Now</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Result */}
                {result && (
                    <View style={styles.resultCard}>
                        <Ionicons name="checkmark-circle" size={32} color="#10B981" />
                        <Text style={styles.resultTitle}>BVN Retrieved Successfully!</Text>
                        <View style={styles.bvnBox}>
                            <Text style={styles.bvnText}>{result.bvn || result.BVN || 'N/A'}</Text>
                        </View>
                        <Text style={styles.resultName}>{result.fullName || result.name || fullName}</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    headerGradient: { paddingHorizontal: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
    badge: { backgroundColor: 'rgba(37,99,235,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#2563eb' },
    badgeText: { color: '#60a5fa', fontSize: 10, fontWeight: '800' },
    titleText: { color: '#ffffff', fontSize: 20, fontWeight: '900' },
    subText: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
    content: { flex: 1, padding: 16 },
    tabContainer: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 12, padding: 4, marginBottom: 16 },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10 },
    activeTab: { backgroundColor: '#2563eb' },
    tabText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
    activeTabText: { color: '#ffffff' },
    formCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 },
    inputLabel: { fontSize: 11, fontWeight: '800', color: '#475569', marginBottom: 8 },
    inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, height: 48 },
    input: { flex: 1, fontSize: 14, fontWeight: '700', color: '#0f172a' },
    costRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, marginBottom: 14 },
    costLabel: { fontSize: 12, color: '#64748b' },
    costVal: { fontSize: 14, fontWeight: '800', color: '#2563eb' },
    btn: { backgroundColor: '#2563eb', height: 48, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    btnText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
    resultCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
    resultTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginTop: 6 },
    bvnBox: { backgroundColor: '#eff6ff', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#bfdbfe', marginVertical: 12 },
    bvnText: { fontSize: 22, fontWeight: '900', color: '#1d4ed8', letterSpacing: 2 },
    resultName: { fontSize: 13, color: '#64748b', fontWeight: '600' },
});
