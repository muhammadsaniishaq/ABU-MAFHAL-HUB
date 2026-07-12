import { View, Text, ScrollView, TouchableOpacity, Switch, Alert, ActivityIndicator, StyleSheet, Platform, TextInput } from 'react-native';
import { useState, useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

// Known features map
const KNOWN_FEATURES = [
    { key: 'feature_wallet_funding', label: 'Wallet Funding', icon: 'wallet' },
    { key: 'feature_transfer', label: 'Fund Transfers', icon: 'swap-horizontal' },
    { key: 'feature_airtime', label: 'Airtime Top-up', icon: 'phone-portrait' },
    { key: 'feature_data', label: 'Data Bundles', icon: 'wifi' },
    { key: 'feature_smile', label: 'Smile Data', icon: 'globe' },
    { key: 'feature_bills', label: 'Cable TV & Bills', icon: 'tv' },
    { key: 'feature_education', label: 'Education (WAEC/NECO)', icon: 'school' },
    { key: 'feature_cards', label: 'Virtual Cards', icon: 'card' },
    { key: 'feature_savings', label: 'Savings', icon: 'leaf' },
    { key: 'feature_invest', label: 'Investments', icon: 'trending-up' },
    { key: 'feature_loans', label: 'Loans', icon: 'cash' },
    { key: 'feature_crypto', label: 'Crypto Trading', icon: 'logo-bitcoin' },
    { key: 'feature_insurance', label: 'Insurance', icon: 'shield-checkmark' },
    { key: 'feature_bvn', label: 'BVN Verification', icon: 'finger-print' },
    { key: 'feature_nin', label: 'NIN Registration', icon: 'person-add' },
    { key: 'feature_cac', label: 'CAC Registration', icon: 'briefcase' },
    { key: 'feature_kyc', label: 'KYC Upgrades', icon: 'id-card' },
    { key: 'feature_social', label: 'Social Boost', icon: 'rocket' },
    { key: 'feature_analytics', label: 'Analytics', icon: 'pie-chart' },
    { key: 'feature_rewards', label: 'Rewards', icon: 'gift' },
    { key: 'feature_referral', label: 'Referrals Program', icon: 'people' },
    { key: 'feature_support', label: 'Customer Support', icon: 'headset' },
    { key: 'feature_qr', label: 'QR Pay', icon: 'qr-code' },
    { key: 'feature_api', label: 'API Services', icon: 'code-slash' },
    { key: 'feature_biometrics', label: 'Biometrics', icon: 'finger-print' },
    { key: 'feature_forensics', label: 'Forensics', icon: 'search' },
    { key: 'feature_wealth', label: 'Wealth', icon: 'briefcase' },
    { key: 'feature_automation', label: 'Automation', icon: 'cog' }
];

interface FeatureFlag {
    feature_key: string;
    label: string;
    is_enabled: boolean;
    maintenance_message: string;
}

export default function ManageFeaturesScreen() {
    const [features, setFeatures] = useState<FeatureFlag[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState<string | null>(null);
    const [editMessage, setEditMessage] = useState<string | null>(null);
    const [messageInput, setMessageInput] = useState('');
    const router = useRouter();

    useEffect(() => {
        fetchFeatures();
    }, []);

    const fetchFeatures = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('feature_flags')
            .select('*')
            .order('label');

        if (error) {
            Alert.alert('Error', 'Failed to load feature flags');
            console.error(error);
            setLoading(false);
            return;
        }

        // Auto-initialize missing features
        const existingKeys = data ? data.map(f => f.feature_key) : [];
        const missingFeatures = KNOWN_FEATURES.filter(f => !existingKeys.includes(f.key));

        if (missingFeatures.length > 0) {
            const newInserts = missingFeatures.map(f => ({
                feature_key: f.key,
                label: f.label,
                is_enabled: true,
                maintenance_message: 'This feature is currently under maintenance.'
            }));
            
            await supabase.from('feature_flags').insert(newInserts);
            
            // Re-fetch after inserting
            const { data: updatedData } = await supabase.from('feature_flags').select('*').order('label');
            if (updatedData) setFeatures(updatedData);
        } else {
            setFeatures(data || []);
        }

        setLoading(false);
    };

    const toggleFeature = async (feature: FeatureFlag) => {
        setUpdating(feature.feature_key);
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        
        const newValue = !feature.is_enabled;

        const { error } = await supabase
            .from('feature_flags')
            .update({ is_enabled: newValue })
            .eq('feature_key', feature.feature_key);

        if (error) {
            Alert.alert('Error', 'Failed to update feature status');
        } else {
            setFeatures(features.map(f => 
                f.feature_key === feature.feature_key ? { ...f, is_enabled: newValue } : f
            ));
        }
        setUpdating(null);
    };

    const saveMessage = async (feature_key: string) => {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const { error } = await supabase
            .from('feature_flags')
            .update({ maintenance_message: messageInput })
            .eq('feature_key', feature_key);

        if (error) {
            Alert.alert('Error', 'Failed to save message');
        } else {
            setFeatures(features.map(f => 
                f.feature_key === feature_key ? { ...f, maintenance_message: messageInput } : f
            ));
            setEditMessage(null);
        }
    };

    const getIconForFeature = (key: string) => {
        const found = KNOWN_FEATURES.find(f => f.key === key);
        return found ? found.icon : 'construct-outline';
    };

    return (
        <View style={s.container}>
            <Stack.Screen options={{ headerShown: false }} />
            
            {/* Premium Header */}
            <LinearGradient colors={['#060d21', '#121F42']} style={s.header}>
                <SafeAreaView edges={['top']}>
                    <View style={s.headerContent}>
                        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
                            <Ionicons name="arrow-back" size={20} color="#ffffff" />
                        </TouchableOpacity>
                        <View style={{ flex: 1, alignItems: 'center' }}>
                            <Text style={s.headerScreenTitle}>Maintenance</Text>
                            <Text style={s.headerScreenSubtitle}>Manage System Features</Text>
                        </View>
                        <View style={{ width: 40 }} />
                    </View>
                </SafeAreaView>
            </LinearGradient>
            
            <ScrollView style={s.scrollView} contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Intro Banner */}
                <View style={s.introBanner}>
                    <Ionicons name="construct" size={24} color="#0d1b3e" style={{ marginBottom: 4 }} />
                    <Text style={s.introTitle}>System Maintenance</Text>
                    <Text style={s.introDesc}>
                        Toggle features ON/OFF to restrict user access. When a feature is OFF, users will see the maintenance message.
                    </Text>
                </View>

                {loading ? (
                    <View style={{ marginTop: 40 }}>
                        <ActivityIndicator size="large" color="#0d1b3e" />
                    </View>
                ) : (
                    <View style={s.listContainer}>
                        {features.map((feature) => (
                            <View key={feature.feature_key} style={s.card}>
                                <View style={s.cardHeader}>
                                    <View style={s.cardHeaderTop}>
                                        <View style={s.cardIconBox}>
                                            <Ionicons name={getIconForFeature(feature.feature_key) as any} size={14} color="#0d1b3e" />
                                        </View>
                                        <View style={s.cardAction}>
                                            {updating === feature.feature_key ? (
                                                <ActivityIndicator color="#0d1b3e" size="small" />
                                            ) : (
                                                <Switch
                                                    trackColor={{ false: "#e2e8f0", true: "#22c55e" }}
                                                    thumbColor="#fff"
                                                    ios_backgroundColor="#e2e8f0"
                                                    style={{ transform: [{ scaleX: 0.65 }, { scaleY: 0.65 }] }}
                                                    onValueChange={() => toggleFeature(feature)}
                                                    value={feature.is_enabled}
                                                />
                                            )}
                                        </View>
                                    </View>
                                    <View style={s.cardInfo}>
                                        <Text style={s.cardTitle} numberOfLines={1}>{feature.label}</Text>
                                        <Text style={s.cardSubtitle} numberOfLines={1}>{feature.feature_key}</Text>
                                    </View>
                                </View>

                                {/* Maintenance Message Section */}
                                {!feature.is_enabled && (
                                    <View style={s.messageBox}>
                                        <View style={s.messageHeader}>
                                            <Ionicons name="information-circle" size={16} color="#ef4444" />
                                            <Text style={s.messageLabel}>Maintenance Message</Text>
                                            {editMessage !== feature.feature_key && (
                                                <TouchableOpacity 
                                                    onPress={() => {
                                                        setEditMessage(feature.feature_key);
                                                        setMessageInput(feature.maintenance_message || '');
                                                    }}
                                                    style={s.editBtn}
                                                >
                                                    <Text style={s.editBtnTxt}>Edit</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                        
                                        {editMessage === feature.feature_key ? (
                                            <View style={s.editContainer}>
                                                <TextInput
                                                    style={s.input}
                                                    value={messageInput}
                                                    onChangeText={setMessageInput}
                                                    multiline
                                                />
                                                <View style={s.editActions}>
                                                    <TouchableOpacity onPress={() => setEditMessage(null)} style={s.cancelBtn}>
                                                        <Text style={s.cancelBtnTxt}>Cancel</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity onPress={() => saveMessage(feature.feature_key)} style={s.saveBtn}>
                                                        <Text style={s.saveBtnTxt}>Save</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        ) : (
                                            <Text style={s.messageText}>
                                                {feature.maintenance_message || 'This feature is currently under maintenance.'}
                                            </Text>
                                        )}
                                    </View>
                                )}
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    scrollView: { flex: 1 },
    header: {
        paddingBottom: 20,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        zIndex: 10,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? 20 : 10,
    },
    backBtn: {
        width: 40, height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)'
    },
    headerScreenTitle: { fontSize: 18, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
    headerScreenSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
    
    introBanner: {
        padding: 20,
        backgroundColor: '#e0e7ff',
        marginHorizontal: 16,
        marginTop: 20,
        borderRadius: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#c7d2fe',
    },
    introTitle: { fontSize: 18, fontWeight: '800', color: '#0d1b3e', marginBottom: 4 },
    introDesc: { fontSize: 13, color: '#312e81', lineHeight: 18 },
    
    listContainer: { paddingHorizontal: 16, marginTop: 4, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        width: '48%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
    },
    cardHeader: { flexDirection: 'column' },
    cardHeaderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    cardIconBox: {
        width: 28, height: 28,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        alignItems: 'center', justifyContent: 'center'
    },
    cardInfo: { flex: 1 },
    cardTitle: { fontSize: 12, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
    cardSubtitle: { fontSize: 9, color: '#64748b' },
    cardAction: { marginRight: -6 },
    
    messageBox: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    messageHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    messageLabel: { fontSize: 11, fontWeight: '600', color: '#ef4444', marginLeft: 6, flex: 1 },
    editBtn: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#f1f5f9', borderRadius: 4 },
    editBtnTxt: { fontSize: 10, fontWeight: '600', color: '#0d1b3e' },
    messageText: { fontSize: 12, color: '#475569', lineHeight: 18, backgroundColor: '#fef2f2', padding: 8, borderRadius: 6 },
    
    editContainer: { marginTop: 4 },
    input: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        color: '#0f172a',
        minHeight: 80,
        textAlignVertical: 'top'
    },
    editActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
    cancelBtn: { paddingHorizontal: 16, paddingVertical: 8, marginRight: 8 },
    cancelBtnTxt: { color: '#64748b', fontWeight: '600' },
    saveBtn: { backgroundColor: '#0d1b3e', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
    saveBtnTxt: { color: '#fff', fontWeight: '600' }
});
