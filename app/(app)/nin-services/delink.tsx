import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../services/api';
import { supabase } from '../../../services/supabase';
import { StatusResult } from '../../../components/StatusResult';
import { verificationHistory } from '../../../services/verificationHistory';
import BrandAlertModal, { AlertType } from '../../../components/BrandAlertModal';

export default function DelinkScreen() {
    const [delinkNIN, setDelinkNIN] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [userBalance, setUserBalance] = useState<number | null>(null);
    const [servicePrice, setServicePrice] = useState<number>(1500);

    const [alertConfig, setAlertConfig] = useState<{
        visible: boolean;
        title: string;
        message: string;
        type: AlertType;
    }>({
        visible: false,
        title: '',
        message: '',
        type: 'info',
    });

    const showAlert = (title: string, message: string, type: AlertType = 'info') => {
        setAlertConfig({ visible: true, title, message, type });
    };

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

    const fetchServicePrice = async () => {
        try {
            const { data } = await supabase
                .from('service_pricing')
                .select('cost_price, markup_price')
                .eq('id', 'nin_mod_phone')
                .maybeSingle();

            if (data) {
                const total = Number(data.cost_price || 0) + Number(data.markup_price || 0);
                if (total > 0) setServicePrice(total);
            }
        } catch (e) {
            console.warn('Failed to load delink price', e);
        }
    };

    useEffect(() => {
        fetchWalletBalance();
        fetchServicePrice();
    }, []);

    const handleVerify = async () => {
        const cleanNin = delinkNIN.trim().replace(/\D/g, '');
        if (cleanNin.length !== 11) {
            return showAlert('Invalid NIN', 'Please enter a valid 11-digit NIN.', 'warning');
        }

        if (userBalance !== null && userBalance < servicePrice) {
            return showAlert(
                'Insufficient Balance',
                `Your wallet balance is ₦${userBalance.toLocaleString()}. Required fee is ₦${servicePrice.toLocaleString()}. Please fund your wallet.`,
                'error'
            );
        }

        setLoading(true);
        setResult(null);

        try {
            const res = await api.identity.delinkAndRetrieve(cleanNin);
            if (res && res.isValid) {
                setResult(res);
                showAlert('Delink Request Submitted', 'Delink request submitted successfully.', 'success');

                await verificationHistory.save({
                    service_category: 'nin',
                    service_type: 'nin_delink',
                    search_number: cleanNin,
                    holder_name: 'NIN Delink Request',
                    layout: 'Delink Phone',
                    details: {
                        nin: cleanNin,
                        status: 'COMPLETED',
                        fee: servicePrice,
                    },
                });

                fetchWalletBalance();
            } else {
                showAlert('Request Failed', res?.message || 'Could not process delink request.', 'error');
            }
        } catch (e: any) {
            const errM = e.message || '';
            if (errM.toLowerCase().includes('not found') || errM.toLowerCase().includes('no record') || errM.toLowerCase().includes('does not exist')) {
                showAlert('No Record Found', 'The record or identity you entered does not exist.', 'error');
            } else {
                showAlert('Request Failed', errM || 'An error occurred during delink.', 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    if (result) {
        return (
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                <Stack.Screen options={{ title: 'Delink Status', headerStyle: { backgroundColor: '#071630' }, headerTintColor: '#F5A623' }} />
                <StatusResult result={result} title="Delink Request Status" />
                <TouchableOpacity
                    onPress={() => setResult(null)}
                    style={{ height: 48, borderRadius: 14, backgroundColor: '#0B2246', borderWidth: 1.5, borderColor: '#F5A623', alignItems: 'center', justifyContent: 'center', marginTop: 16 }}
                >
                    <Text style={{ color: '#F5A623', fontWeight: '800', fontSize: 13 }}>DELINK ANOTHER RECORD</Text>
                </TouchableOpacity>
            </ScrollView>
        );
    }

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: 'Delink Phone',
                    headerStyle: { backgroundColor: '#071630' },
                    headerTintColor: '#F5A623',
                    headerShadowVisible: false,
                    headerRight: () => (
                        <TouchableOpacity onPress={() => router.push('/nin-services/history?tab=nin')} style={{ marginRight: 8 }}>
                            <Ionicons name="time-outline" size={22} color="#F5A623" />
                        </TouchableOpacity>
                    ),
                }}
            />
            <StatusBar style="light" />

            <View style={styles.formContainer}>
                {/* Header Info */}
                <View style={styles.infoBox}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(245, 166, 35, 0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                        <Ionicons name="cut" size={22} color="#F5A623" />
                    </View>
                    <Text style={styles.infoTitle}>Delink Phone from NIN</Text>
                    <Text style={styles.infoDesc}>Submit a secure request to detach an old or compromised mobile number from a NIN record.</Text>
                    <View style={{ marginTop: 10, backgroundColor: 'rgba(245, 166, 35, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(245, 166, 35, 0.3)' }}>
                        <Text style={{ color: '#F5A623', fontWeight: '800', fontSize: 11 }}>Service Fee: ₦{servicePrice.toLocaleString()}</Text>
                    </View>
                </View>

                {/* Input Field */}
                <Text style={{ color: '#071630', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 6 }}>11-DIGIT NIN NUMBER</Text>
                <TextInput
                    placeholder="Enter NIN to Delink"
                    placeholderTextColor="#94a3b8"
                    style={styles.input}
                    keyboardType="number-pad"
                    maxLength={11}
                    value={delinkNIN}
                    onChangeText={(t) => setDelinkNIN(t.replace(/\D/g, ''))}
                    editable={!loading}
                />

                <TouchableOpacity onPress={handleVerify} disabled={loading || delinkNIN.length !== 11} style={[styles.button, (loading || delinkNIN.length !== 11) && { opacity: 0.6 }]} activeOpacity={0.8}>
                    {loading ? <ActivityIndicator color="#071630" /> : <Text style={styles.buttonText}>Submit Delink Request</Text>}
                </TouchableOpacity>
            </View>

            <BrandAlertModal
                visible={alertConfig.visible}
                title={alertConfig.title}
                message={alertConfig.message}
                type={alertConfig.type}
                onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    content: {
        padding: 20,
        paddingBottom: 50,
    },
    formContainer: {
        padding: 20,
        paddingTop: 24,
        flex: 1,
    },
    infoBox: {
        backgroundColor: '#071630',
        padding: 20,
        borderRadius: 20,
        marginBottom: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(245, 166, 35, 0.25)',
    },
    infoTitle: {
        color: '#FFFFFF',
        fontWeight: '900',
        fontSize: 16,
    },
    infoDesc: {
        color: '#94A3B8',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 4,
        lineHeight: 17,
    },
    input: {
        backgroundColor: '#ffffff',
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        borderRadius: 14,
        paddingHorizontal: 16,
        height: 52,
        marginBottom: 20,
        color: '#071630',
        fontWeight: '700',
        fontSize: 15,
    },
    button: {
        backgroundColor: '#F5A623',
        height: 52,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#F5A623',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 3,
    },
    buttonText: {
        color: '#071630',
        fontWeight: '900',
        fontSize: 14,
        letterSpacing: 0.5,
    },
});
