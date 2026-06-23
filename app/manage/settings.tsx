import { View, Text, Switch, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AdminSettings() {
    const router = useRouter();
    const [maintenance, setMaintenance] = useState(false);
    const [registrations, setRegistrations] = useState(true);
    const [usdNgnRate, setUsdNgnRate] = useState('1450.00');
    const [loading, setLoading] = useState(false);
    const [keysLoading, setKeysLoading] = useState(false);

    // API Keys state
    const [paystackKey, setPaystackKey] = useState('');
    const [monnifyKey, setMonnifyKey] = useState('');
    const [payvesselKey, setPayvesselKey] = useState('');
    const [payvesselSecret, setPayvesselSecret] = useState('');
    const [payvesselBusinessId, setPayvesselBusinessId] = useState('');
    const [termiiKey, setTermiiKey] = useState('');
    const [flutterwaveKey, setFlutterwaveKey] = useState('');

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const { data } = await supabase
                .from('exchange_rates')
                .select('sell_rate')
                .eq('pair', 'USDT / NGN')
                .single();
            if (data) setUsdNgnRate(String(data.sell_rate));

            // Fetch keys from system_secrets (Only works if user is admin)
            const { data: secrets } = await supabase.from('system_secrets').select('key, value');
            if (secrets) {
                secrets.forEach((secret) => {
                    if (secret.key === 'PAYSTACK_SECRET_KEY') setPaystackKey(secret.value);
                    if (secret.key === 'MONNIFY_API_KEY') setMonnifyKey(secret.value);
                    if (secret.key === 'PAYVESSEL_API_KEY') setPayvesselKey(secret.value);
                    if (secret.key === 'PAYVESSEL_API_SECRET') setPayvesselSecret(secret.value);
                    if (secret.key === 'PAYVESSEL_BUSINESS_ID') setPayvesselBusinessId(secret.value);
                    if (secret.key === 'TERMII_API_KEY') setTermiiKey(secret.value);
                    if (secret.key === 'FLUTTERWAVE_SECRET_KEY') setFlutterwaveKey(secret.value);
                });
            }
        } catch (e) { }
    };

    const handleSaveKeys = async () => {
        setKeysLoading(true);
        try {
            const keysToSave = [
                { key: 'PAYSTACK_SECRET_KEY', value: paystackKey, description: 'Paystack Secret Key' },
                { key: 'MONNIFY_API_KEY', value: monnifyKey, description: 'Monnify API Key' },
                { key: 'PAYVESSEL_API_KEY', value: payvesselKey, description: 'Payvessel API Key' },
                { key: 'PAYVESSEL_API_SECRET', value: payvesselSecret, description: 'Payvessel API Secret' },
                { key: 'PAYVESSEL_BUSINESS_ID', value: payvesselBusinessId, description: 'Payvessel Business ID' },
                { key: 'TERMII_API_KEY', value: termiiKey, description: 'Termii SMS API Key' },
                { key: 'FLUTTERWAVE_SECRET_KEY', value: flutterwaveKey, description: 'Flutterwave Secret Key' }
            ].filter(k => k.value && k.value.trim() !== '');

            if (keysToSave.length > 0) {
                const { error } = await supabase.from('system_secrets').upsert(keysToSave);
                if (error) throw error;
            }
            Alert.alert('Success', 'API keys have been securely saved and are now live.');
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setKeysLoading(false);
        }
    };

    const handleUpdateEconomics = async () => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('exchange_rates')
                .update({ sell_rate: parseFloat(usdNgnRate), updated_at: new Date().toISOString() })
                .eq('pair', 'USDT / NGN');

            if (error) throw error;
            Alert.alert('Success', 'Economic parameters updated successfully');
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={s.container} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />
            
            <View style={s.header}>
                <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#f5a623" />
                </TouchableOpacity>
                <View>
                    <Text style={s.headerTitle}>Admin Settings</Text>
                    <Text style={s.headerSubtitle}>System Configuration</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
                
                {/* General Controls */}
                <View style={s.section}>
                    <Text style={s.sectionTitle}>General Controls</Text>
                    <View style={s.card}>
                        <View style={[s.row, s.borderBottom]}>
                            <View style={s.rowLeft}>
                                <Ionicons name="power" size={20} color="#0d1b3e" style={s.icon} />
                                <Text style={s.rowText}>Maintenance Mode</Text>
                            </View>
                            <Switch value={maintenance} onValueChange={setMaintenance} trackColor={{ true: '#f5a623', false: '#e2e8f0' }} />
                        </View>
                        <View style={s.row}>
                            <View style={s.rowLeft}>
                                <Ionicons name="person-add" size={20} color="#0d1b3e" style={s.icon} />
                                <Text style={s.rowText}>Allow Registrations</Text>
                            </View>
                            <Switch value={registrations} onValueChange={setRegistrations} trackColor={{ true: '#f5a623', false: '#e2e8f0' }} />
                        </View>
                    </View>
                </View>

                {/* Economics */}
                <View style={s.section}>
                    <Text style={s.sectionTitle}>Economic Parameters</Text>
                    <View style={s.card}>
                        <View style={s.inputGroup}>
                            <Text style={s.label}>USD/NGN Exchange Rate (Live)</Text>
                            <View style={s.inputWrapper}>
                                <Text style={s.inputPrefix}>₦</Text>
                                <TextInput
                                    value={usdNgnRate}
                                    onChangeText={setUsdNgnRate}
                                    style={s.input}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>
                        
                        <TouchableOpacity onPress={handleUpdateEconomics} style={s.primaryBtn}>
                            {loading ? <ActivityIndicator color="#0d1b3e" /> : <Text style={s.primaryBtnText}>UPDATE ECONOMICS</Text>}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* API Configurations */}
                <View style={s.section}>
                    <Text style={s.sectionTitle}>API Configurations</Text>
                    <View style={s.card}>
                        
                        <View style={s.apiGroup}>
                            <Text style={s.apiGroupTitle}>Payvessel (Virtual Accounts)</Text>
                            <View style={s.inputGroup}>
                                <Text style={s.label}>API Key</Text>
                                <TextInput 
                                    value={payvesselKey}
                                    onChangeText={setPayvesselKey}
                                    placeholder="PVKEY-..." 
                                    secureTextEntry 
                                    style={s.inputMono} 
                                    placeholderTextColor="#94a3b8"
                                />
                            </View>
                            <View style={s.inputGroup}>
                                <Text style={s.label}>API Secret</Text>
                                <TextInput 
                                    value={payvesselSecret}
                                    onChangeText={setPayvesselSecret}
                                    placeholder="PVSECRET-..." 
                                    secureTextEntry 
                                    style={s.inputMono} 
                                    placeholderTextColor="#94a3b8"
                                />
                            </View>
                            <View style={s.inputGroup}>
                                <Text style={s.label}>Business ID</Text>
                                <TextInput 
                                    value={payvesselBusinessId}
                                    onChangeText={setPayvesselBusinessId}
                                    placeholder="Business ID..." 
                                    style={s.inputMono} 
                                    placeholderTextColor="#94a3b8"
                                />
                            </View>
                        </View>

                        <View style={s.apiGroup}>
                            <Text style={s.apiGroupTitle}>Other Providers</Text>
                            <View style={s.inputGroup}>
                                <Text style={s.label}>Paystack Secret Key</Text>
                                <TextInput 
                                    value={paystackKey}
                                    onChangeText={setPaystackKey}
                                    placeholder="sk_live_..." 
                                    secureTextEntry 
                                    style={s.inputMono} 
                                    placeholderTextColor="#94a3b8"
                                />
                            </View>
                            <View style={s.inputGroup}>
                                <Text style={s.label}>Flutterwave Secret Key</Text>
                                <TextInput 
                                    value={flutterwaveKey}
                                    onChangeText={setFlutterwaveKey}
                                    placeholder="FLWSECK-..." 
                                    secureTextEntry 
                                    style={s.inputMono} 
                                    placeholderTextColor="#94a3b8"
                                />
                            </View>
                            <View style={s.inputGroup}>
                                <Text style={s.label}>Termii API Key</Text>
                                <TextInput 
                                    value={termiiKey}
                                    onChangeText={setTermiiKey}
                                    placeholder="..." 
                                    secureTextEntry 
                                    style={s.inputMono} 
                                    placeholderTextColor="#94a3b8"
                                />
                            </View>
                            <View style={s.inputGroup}>
                                <Text style={s.label}>Monnify API Key</Text>
                                <TextInput 
                                    value={monnifyKey}
                                    onChangeText={setMonnifyKey}
                                    placeholder="MK_PROD_..." 
                                    secureTextEntry 
                                    style={s.inputMono} 
                                    placeholderTextColor="#94a3b8"
                                />
                            </View>
                        </View>

                        <TouchableOpacity onPress={handleSaveKeys} style={s.primaryBtn}>
                            {keysLoading ? <ActivityIndicator color="#0d1b3e" /> : <Text style={s.primaryBtnText}>SAVE API KEYS</Text>}
                        </TouchableOpacity>
                    </View>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f9fc' },
    header: { backgroundColor: '#0d1b3e', paddingHorizontal: 24, paddingVertical: 24, paddingBottom: 32, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 15, elevation: 5, marginBottom: 24, flexDirection: 'row', alignItems: 'center' },
    backBtn: { width: 40, height: 40, justifyContent: 'center', marginRight: 12 },
    headerTitle: { fontSize: 24, fontWeight: '900', color: '#ffffff', letterSpacing: 1, textTransform: 'uppercase' },
    headerSubtitle: { fontSize: 14, fontWeight: '500', color: '#f5a623', letterSpacing: 1 },
    
    scrollContent: { paddingHorizontal: 20, paddingBottom: 60 },
    
    section: { marginBottom: 32 },
    sectionTitle: { fontSize: 12, fontWeight: '900', color: '#94a3b8', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12, marginLeft: 4 },
    
    card: { backgroundColor: '#ffffff', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 4, borderWidth: 1, borderColor: '#f1f5f9' },
    
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
    rowLeft: { flexDirection: 'row', alignItems: 'center' },
    borderBottom: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    icon: { marginRight: 12, opacity: 0.8 },
    rowText: { fontSize: 15, fontWeight: '700', color: '#0d1b3e' },

    inputGroup: { marginBottom: 20 },
    label: { fontSize: 11, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
    inputWrapper: { backgroundColor: '#f8f9fc', borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderWidth: 1, borderColor: '#e2e8f0' },
    inputPrefix: { fontSize: 16, fontWeight: '900', color: '#94a3b8', marginRight: 8 },
    input: { height: 56, flex: 1, fontSize: 18, fontWeight: '800', color: '#0d1b3e' },
    inputMono: { height: 52, backgroundColor: '#f8f9fc', borderRadius: 12, paddingHorizontal: 16, fontSize: 14, fontWeight: '600', color: '#0d1b3e', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', borderWidth: 1, borderColor: '#e2e8f0' },

    apiGroup: { marginBottom: 24, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    apiGroupTitle: { fontSize: 14, fontWeight: '900', color: '#f5a623', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 },

    primaryBtn: { height: 56, backgroundColor: '#f5a623', justifyContent: 'center', alignItems: 'center', borderRadius: 12, shadowColor: '#f5a623', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 5, mt: 8 },
    primaryBtnText: { color: '#0d1b3e', fontSize: 13, fontWeight: '900', letterSpacing: 1.5, textTransform: 'uppercase' },
});
