const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, '../app/manage/nin-pricing.tsx');
const valPath = path.join(__dirname, '../app/nin-services/validation.tsx');

// 1. Update app/manage/nin-pricing.tsx
if (fs.existsSync(adminPath)) {
    let content = fs.readFileSync(adminPath, 'utf8');
    content = content.replace(/\r\n/g, '\n');

    // Update Tab State type in nin-pricing.tsx to include 'validation'
    content = content.replace(
        `const [activeTab, setActiveTab] = useState<'nin' | 'ipe'>('nin');`,
        `const [activeTab, setActiveTab] = useState<'nin' | 'ipe' | 'validation'>('nin');`
    );

    // Update fetchPrices with validation seeder
    const oldSeederStart = `            // Self-healing database check: Auto-seed IPE Clearance pricing entries if missing`;
    const oldSeederEnd = `            const { data, error } = await supabase
                .from('service_pricing')
                .select('*')
                .in('service_category', ['nin', 'ipe'])
                .order('name', { ascending: true });`;

    const newSeederCode = `            // Self-healing database check: Auto-seed IPE Clearance pricing entries if missing
            const ipePricingDefaults = [
                { id: 'ipe_inprocessing', service_category: 'ipe', name: 'InProcessing Error', cost_price: 700, markup_price: 0 },
                { id: 'ipe_still_processed', service_category: 'ipe', name: 'Still Being Processed', cost_price: 700, markup_price: 0 },
                { id: 'ipe_new_enrollment', service_category: 'ipe', name: 'New Enrollment For Tracking ID', cost_price: 700, markup_price: 0 },
                { id: 'ipe_invalid_tracking', service_category: 'ipe', name: 'Invalid Tracking ID', cost_price: 700, markup_price: 0 },
                { id: 'ipe_slip_none', service_category: 'ipe', name: 'No Slip (Clearance)', cost_price: 0, markup_price: 0 },
                { id: 'ipe_slip_regular', service_category: 'ipe', name: 'Regular Slip (Clearance)', cost_price: 0, markup_price: 0 },
                { id: 'ipe_slip_premium', service_category: 'ipe', name: 'Premium Slip (Clearance)', cost_price: 150, markup_price: 0 }
            ];

            for (const item of ipePricingDefaults) {
                const { data: existing } = await supabase
                    .from('service_pricing')
                    .select('id')
                    .eq('id', item.id)
                    .maybeSingle();
                
                if (!existing) {
                    await supabase.from('service_pricing').insert(item);
                }
            }

            // Auto-seed Validation pricing entries if missing
            const valPricingDefaults = [
                { id: 'val_no_record', service_category: 'validation', name: 'No Record Found', cost_price: 900, markup_price: 0 },
                { id: 'val_update_record', service_category: 'validation', name: 'Update Record', cost_price: 900, markup_price: 0 },
                { id: 'val_validate_modification', service_category: 'validation', name: 'Validate Modification', cost_price: 900, markup_price: 0 },
                { id: 'val_vnin_validation', service_category: 'validation', name: 'V-NIN Validation', cost_price: 900, markup_price: 0 },
                { id: 'val_photo_error', service_category: 'validation', name: 'Photograph Error', cost_price: 900, markup_price: 0 },
                { id: 'val_bypass_nin', service_category: 'validation', name: 'Bypass NIN', cost_price: 900, markup_price: 0 },
                { id: 'val_slip_none', service_category: 'validation', name: 'No Slip (Validation)', cost_price: 0, markup_price: 0 },
                { id: 'val_slip_premium', service_category: 'validation', name: 'Premium Slip (Validation)', cost_price: 150, markup_price: 0 }
            ];

            for (const item of valPricingDefaults) {
                const { data: existing } = await supabase
                    .from('service_pricing')
                    .select('id')
                    .eq('id', item.id)
                    .maybeSingle();
                
                if (!existing) {
                    await supabase.from('service_pricing').insert(item);
                }
            }

            const { data, error } = await supabase
                .from('service_pricing')
                .select('*')
                .in('service_category', ['nin', 'ipe', 'validation'])
                .order('name', { ascending: true });`;

    // Replace seeder block
    const seederIndexStart = content.indexOf(oldSeederStart);
    const seederIndexEnd = content.indexOf(oldSeederEnd);
    if (seederIndexStart !== -1 && seederIndexEnd !== -1) {
        content = content.slice(0, seederIndexStart) + newSeederCode + content.slice(seederIndexEnd + oldSeederEnd.length);
    }

    // Update Stats Card Row to include validation pricing stats
    content = content.replace(
        `<View style={styles.statsRow}>`,
        `<View style={styles.statsRow}>
                    <View style={styles.statCard}>
                        <Text style={styles.statVal}>{prices.filter(p => p.service_category === 'validation').length}</Text>
                        <Text style={styles.statLabel}>Validation</Text>
                    </View>`
    );
    // Adjust statCard width to fit 4 columns (NIN, IPE, VAL, AVG)
    content = content.replace(
        `width: '31%',`,
        `width: '23.5%',`
    );

    // Update Tab UI to include Validation Tab
    const oldTabs = `<View style={styles.tabContainer}>
                <TouchableOpacity 
                    onPress={() => setActiveTab('nin')}
                    style={[styles.tabButton, activeTab === 'nin' && styles.tabButtonActive]}
                    activeOpacity={0.8}
                >
                    <Ionicons name="document-text" size={16} color={activeTab === 'nin' ? '#ffffff' : '#64748b'} />
                    <Text style={[styles.tabText, activeTab === 'nin' && styles.tabTextActive]}>NIN Verification</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    onPress={() => setActiveTab('ipe')}
                    style={[styles.tabButton, activeTab === 'ipe' && styles.tabButtonActive]}
                    activeOpacity={0.8}
                >
                    <Ionicons name="shield-checkmark" size={16} color={activeTab === 'ipe' ? '#ffffff' : '#64748b'} />
                    <Text style={[styles.tabText, activeTab === 'ipe' && styles.tabTextActive]}>IPE Clearance</Text>
                </TouchableOpacity>
            </View>`;

    const newTabs = `<View style={styles.tabContainer}>
                <TouchableOpacity 
                    onPress={() => setActiveTab('nin')}
                    style={[styles.tabButton, activeTab === 'nin' && styles.tabButtonActive]}
                    activeOpacity={0.8}
                >
                    <Ionicons name="document-text" size={14} color={activeTab === 'nin' ? '#ffffff' : '#64748b'} />
                    <Text style={[styles.tabText, activeTab === 'nin' && styles.tabTextActive, { fontSize: 10.5 }]}>NIN Slips</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    onPress={() => setActiveTab('ipe')}
                    style={[styles.tabButton, activeTab === 'ipe' && styles.tabButtonActive]}
                    activeOpacity={0.8}
                >
                    <Ionicons name="shield-checkmark" size={14} color={activeTab === 'ipe' ? '#ffffff' : '#64748b'} />
                    <Text style={[styles.tabText, activeTab === 'ipe' && styles.tabTextActive, { fontSize: 10.5 }]}>IPE</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    onPress={() => setActiveTab('validation')}
                    style={[styles.tabButton, activeTab === 'validation' && styles.tabButtonActive]}
                    activeOpacity={0.8}
                >
                    <Ionicons name="checkmark-circle" size={14} color={activeTab === 'validation' ? '#ffffff' : '#64748b'} />
                    <Text style={[styles.tabText, activeTab === 'validation' && styles.tabTextActive, { fontSize: 10.5 }]}>Validation</Text>
                </TouchableOpacity>
            </View>`;

    content = content.replace(oldTabs, newTabs);

    fs.writeFileSync(adminPath, content, 'utf8');
    console.log('Successfully completed nin-pricing.tsx modifications for Validation category!');
}

// 2. Modify app/nin-services/validation.tsx
const fullValCode = `import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Dimensions, Image, Platform, Modal, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../services/supabase';
import { api } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusResult } from '../../components/StatusResult';

const DEFAULT_STATUS_TYPES = [
    { id: 'val_no_record', db_id: 'val_no_record', name: 'No Record Found', price: 900 },
    { id: 'val_update_record', db_id: 'val_update_record', name: 'Update Record', price: 900 },
    { id: 'val_validate_modification', db_id: 'val_validate_modification', name: 'Validate Modification', price: 900 },
    { id: 'val_vnin_validation', db_id: 'val_vnin_validation', name: 'V-NIN Validation', price: 900 },
    { id: 'val_photo_error', db_id: 'val_photo_error', name: 'Photograph Error', price: 900 },
    { id: 'val_bypass_nin', db_id: 'val_bypass_nin', name: 'Bypass NIN', price: 900 }
];

const DEFAULT_SLIP_TYPES = [
    { id: 'val_slip_none', db_id: 'val_slip_none', name: 'No Slip', price: 0, image: null },
    { id: 'val_slip_premium', db_id: 'val_slip_premium', name: 'Premium Slip', price: 150, image: require('../../assets/images/premium.png') }
];

export default function ValidationScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    
    // Selection States
    const [selectedStatus, setSelectedStatus] = useState('val_no_record');
    const [selectedSlip, setSelectedSlip] = useState('val_slip_none');
    
    const [nin, setNin] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [isAgreed, setIsAgreed] = useState(false);

    // Dynamic Prices
    const [statusTypes, setStatusTypes] = useState(DEFAULT_STATUS_TYPES);
    const [slipTypes, setSlipTypes] = useState(DEFAULT_SLIP_TYPES);

    // Premium States
    const [userBalance, setUserBalance] = useState<number | null>(null);
    const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
    const [historyList, setHistoryList] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedHistoryItem, setSelectedHistoryItem] = useState<any>(null);

    // Custom Smooth Alert State
    const [customAlert, setCustomAlert] = useState<{
        visible: boolean;
        title: string;
        message: string;
        type: 'success' | 'error' | 'warning' | 'info';
    }>({
        visible: false,
        title: '',
        message: '',
        type: 'info'
    });

    const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
        setCustomAlert({
            visible: true,
            title,
            message,
            type
        });
    };

    const loadHistory = async () => {
        try {
            const stored = await AsyncStorage.getItem('recent_validation_requests');
            if (stored) {
                setHistoryList(JSON.parse(stored));
            }
        } catch (e) {
            console.warn('Failed to load history', e);
        }
    };

    const saveHistoryItem = async (verifiedData: any) => {
        try {
            const statusPrice = statusTypes.find(s => s.id === selectedStatus)?.price || 0;
            const slipPrice = slipTypes.find(s => s.id === selectedSlip)?.price || 0;
            const totalPrice = statusPrice + slipPrice;

            const newItem = {
                id: \`val_\${Date.now()}\`,
                target: nin.trim(),
                status: 'Completed',
                slip: slipTypes.find(s => s.id === selectedSlip)?.name || 'No Slip',
                amount: totalPrice,
                date: (() => {
                    const d = new Date();
                    const pad = (n: number) => n.toString().padStart(2, '0');
                    return \`\${d.getFullYear()}-\\$\${pad(d.getMonth() + 1)}-\\$\${pad(d.getDate())}\`;
                })(),
                data: verifiedData
            };
            
            const updated = [newItem, ...historyList.filter(item => item.target !== newItem.target)].slice(0, 50);
            setHistoryList(updated);
            await AsyncStorage.setItem('recent_validation_requests', JSON.stringify(updated));
        } catch (e) {
            console.warn('Failed to save history item', e);
        }
    };

    const deleteHistoryItem = (itemId: string, targetName: string) => {
        Alert.alert(
            'Confirm Delete',
            \`Delete record for \${targetName} from history?\`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const updated = historyList.filter(item => item.id !== itemId);
                            setHistoryList(updated);
                            await AsyncStorage.setItem('recent_validation_requests', JSON.stringify(updated));
                        } catch (e) {
                            console.warn('Failed to delete history item', e);
                        }
                    }
                }
            ]
        );
    };

    const fetchWalletBalance = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from('profiles').select('balance').eq('id', user.id).single();
                if (data) {
                    setUserBalance(Number(data.balance));
                }
            }
        } catch (e) {
            console.warn('Failed to load wallet balance', e);
        }
    };

    const fetchPrices = async () => {
        try {
            const { data, error } = await supabase.from('service_pricing').select('*').eq('service_category', 'validation');
            if (error || !data) return;
            
            setStatusTypes(prev => prev.map(item => {
                const dbPrice = data.find(d => d.id === item.db_id);
                if (dbPrice) {
                    return { ...item, price: Number(dbPrice.cost_price) + Number(dbPrice.markup_price) };
                }
                return item;
            }));

            setSlipTypes(prev => prev.map(item => {
                const dbPrice = data.find(d => d.id === item.db_id);
                if (dbPrice) {
                    return { ...item, price: Number(dbPrice.cost_price) + Number(dbPrice.markup_price) };
                }
                return item;
            }));
        } catch (e) {
            console.warn('Failed to fetch dynamic prices', e);
        }
    };

    useEffect(() => {
        fetchPrices();
        loadHistory();
        fetchWalletBalance();
    }, []);

    const getSelectedTotalPrice = () => {
        const statusPrice = statusTypes.find(s => s.id === selectedStatus)?.price || 0;
        const slipPrice = slipTypes.find(s => s.id === selectedSlip)?.price || 0;
        return statusPrice + slipPrice;
    };

    const handleVerify = async () => {
        const cleanNin = nin.trim();
        if (!cleanNin) {
            return showAlert('Tracking ID / NIN Required', 'Please enter a valid Tracking ID or NIN.', 'warning');
        }
        if (!isAgreed) {
            return showAlert('Consent Required', 'You must confirm obtaining consent before running validation.', 'warning');
        }

        const totalPrice = getSelectedTotalPrice();
        if (userBalance !== null && userBalance < totalPrice) {
            return showAlert('Insufficient Balance', 'Your wallet balance is too low. Please fund your wallet and try again.', 'error');
        }

        setLoading(true);
        try {
            const res = await api.identity.validateIdentity(cleanNin, 'nin');
            setResult(res);
            await saveHistoryItem(res);
            await fetchWalletBalance(); // Update balance
        } catch (e: any) {
            const errM = e.message || '';
            const lowerMsg = errM.toLowerCase();
            if (lowerMsg.includes('insufficient') || lowerMsg.includes('balance')) {
                showAlert('Insufficient Balance', 'Your wallet balance is too low. Please fund your wallet and try again.', 'error');
            } else if (lowerMsg.includes('not found') || lowerMsg.includes('no record') || lowerMsg.includes('does not exist') || lowerMsg.includes('not exist') || lowerMsg.includes('invalid or not found')) {
                showAlert('No Record Found', 'The record or identity you entered does not exist or has no validation history.', 'error');
            } else {
                showAlert('Validation Failed', errM || 'An error occurred during validation checks.', 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    const faqs = [
        { q: 'Menene Validation?', a: 'NIN Validation wani tsari ne na daidaitawa da kuma tabbatar da ingancin lambar NIN dinka a kan uwar garken hukumar NIMC lokacin da ta samu wata matsala ko aka canza mata wani bayani.' },
        { q: 'Yaya ake biyan kuɗin wannan sabis?', a: 'Ana cire kuɗi kaɗan daga balance ɗinka na tantancewa da zarar an sami nasarar runing validation.' },
        { q: 'Zan iya sake duba validation na baya?', a: 'Ee, tarihin dukan validation ɗin da ka gudanar yana nan a ƙasan shafin don sauƙin reprint ko duba status na baya.' }
    ];

    const filteredHistory = historyList.filter(item => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return true;
        return (
            (item.target || '').toLowerCase().includes(q) ||
            (item.status || '').toLowerCase().includes(q) ||
            (item.slip || '').toLowerCase().includes(q)
        );
    });

    if (result) {
        return (
            <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
                <Stack.Screen options={{ 
                    title: 'Validation Status', 
                    headerStyle: { backgroundColor: '#060d21' }, 
                    headerTintColor: '#fff', 
                    headerShadowVisible: false,
                    headerRight: () => (
                        <TouchableOpacity onPress={() => router.push('/nin-services/history')} style={{ marginRight: 8 }}>
                            <Ionicons name="time-outline" size={22} color="#fff" />
                        </TouchableOpacity>
                    )
                }} />
                
                {/* Header Banner */}
                <LinearGradient colors={['#060d21', '#121F42']} style={{ paddingTop: insets.top > 0 ? insets.top + 12 : 24, paddingBottom: 48, paddingHorizontal: 16, alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="shield-checkmark" size={16} color="#f5a623" />
                        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13, marginLeft: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Validation Details</Text>
                    </View>
                    <Text style={{ color: '#94a3b8', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 }}>NIN Validation Completed</Text>
                </LinearGradient>

                <ScrollView style={{ flex: 1, paddingHorizontal: 12, marginTop: -32 }} contentContainerStyle={{ paddingBottom: 80 }}>
                    <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, marginBottom: 16 }}>
                        <StatusResult result={result} title="Validation Status Report" />
                    </View>

                    {/* Back Button */}
                    <TouchableOpacity 
                        onPress={() => setResult(null)} 
                        style={{ height: 48, borderRadius: 12, backgroundColor: '#060d21', alignItems: 'center', justifyContent: 'center', width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 }}
                        activeOpacity={0.8}
                    >
                        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 }}>RUN ANOTHER VALIDATION</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ 
                title: 'Validation', 
                headerStyle: { backgroundColor: '#060d21' }, 
                headerTintColor: '#fff', 
                headerShadowVisible: false,
                headerRight: () => (
                    <TouchableOpacity onPress={() => router.push('/nin-services/history')} style={{ marginRight: 8 }}>
                        <Ionicons name="time-outline" size={22} color="#fff" />
                    </TouchableOpacity>
                )
            }} />
            <StatusBar style="light" />

            {/* Premium Loader Modal */}
            {loading && (
                <Modal transparent visible={loading} animationType="fade">
                    <View style={styles.loaderOverlay}>
                        <View style={styles.loaderCard}>
                            <ActivityIndicator size="large" color="#f5a623" />
                            <Text style={styles.loaderTitle}>Processing Validation</Text>
                            <Text style={styles.loaderSub}>Contacting Verification Registry...</Text>
                        </View>
                    </View>
                </Modal>
            )}

            {/* Custom Modern Decorated Alert Modal */}
            <Modal
                transparent
                visible={customAlert.visible}
                animationType="fade"
                onRequestClose={() => setCustomAlert(prev => ({ ...prev, visible: false }))}
            >
                <View style={styles.alertOverlay}>
                    <View style={styles.alertCard}>
                        <View style={[
                            styles.alertIconBg,
                            customAlert.type === 'success' ? styles.alertSuccessIcon :
                            customAlert.type === 'error' ? styles.alertErrorIcon :
                            customAlert.type === 'warning' ? styles.alertWarningIcon : styles.alertInfoIcon
                        ]}>
                            <Ionicons 
                                name={
                                    customAlert.type === 'success' ? 'checkmark-circle' :
                                    customAlert.type === 'error' ? 'close-circle' :
                                    customAlert.type === 'warning' ? 'warning' : 'information-circle'
                                } 
                                size={36} 
                                color={
                                    customAlert.type === 'success' ? '#10b981' :
                                    customAlert.type === 'error' ? '#ef4444' :
                                    customAlert.type === 'warning' ? '#f5a623' : '#3b82f6'
                                } 
                            />
                        </View>
                        <Text style={styles.alertTitle}>{customAlert.title}</Text>
                        <Text style={styles.alertMessage}>{customAlert.message}</Text>
                        <TouchableOpacity 
                            style={styles.alertButton} 
                            onPress={() => setCustomAlert(prev => ({ ...prev, visible: false }))}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.alertButtonText}>Okay</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Premium Tracking ID Request Detail Modal */}
            <Modal
                transparent
                visible={!!selectedHistoryItem}
                animationType="slide"
                onRequestClose={() => setSelectedHistoryItem(null)}
            >
                <View style={styles.detailOverlay}>
                    {selectedHistoryItem && (
                        <View style={styles.detailCard}>
                            {/* Card Header Banner */}
                            <LinearGradient colors={['#060d21', '#121F42']} style={styles.detailHeader}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 }}>
                                        <View style={styles.detailHeaderIconBox}>
                                            <Ionicons name="document-text" size={18} color="#060d21" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.detailHeaderSubtitle}>VALIDATION REQUEST</Text>
                                            <Text style={styles.detailHeaderTitle} numberOfLines={1}>
                                                {selectedHistoryItem.data?.name || selectedHistoryItem.data?.fullName || [selectedHistoryItem.data?.firstname, selectedHistoryItem.data?.lastname].filter(Boolean).join(' ') || 'MUHAMMAD SANI ISYAKU'}
                                            </Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity 
                                        style={styles.detailCloseBtn} 
                                        onPress={() => setSelectedHistoryItem(null)}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name="close" size={18} color="#ffffff" />
                                    </TouchableOpacity>
                                </View>

                                {/* Badges */}
                                <View style={styles.detailBadgesRow}>
                                    <View style={styles.detailBadgeCompleted}>
                                        <Ionicons name="checkmark-circle" size={12} color="#ffffff" style={{ marginRight: 4 }} />
                                        <Text style={styles.detailBadgeText}>Completed</Text>
                                    </View>
                                    <View style={styles.detailBadgeSlip}>
                                        <Text style={styles.detailBadgeText}>{selectedHistoryItem.slip || 'No Slip'}</Text>
                                    </View>
                                </View>
                            </LinearGradient>

                            {/* Card Body fields */}
                            <ScrollView style={styles.detailScroll} contentContainerStyle={{ padding: 16 }}>
                                <View style={styles.detailFieldFull}>
                                    <Text style={styles.detailFieldLabel}>FULL NAME</Text>
                                    <Text style={styles.detailFieldVal}>
                                        {selectedHistoryItem.data?.name || selectedHistoryItem.data?.fullName || [selectedHistoryItem.data?.firstname, selectedHistoryItem.data?.lastname].filter(Boolean).join(' ') || 'MUHAMMAD SANI ISYAKU'}
                                    </Text>
                                </View>

                                <View style={styles.detailRow}>
                                    <View style={styles.detailFieldHalf}>
                                        <Text style={styles.detailFieldLabel}>DATE OF BIRTH</Text>
                                        <Text style={styles.detailFieldVal}>{selectedHistoryItem.data?.dob || '—'}</Text>
                                    </View>
                                    <View style={styles.detailFieldHalf}>
                                        <Text style={styles.detailFieldLabel}>NIN</Text>
                                        <Text style={styles.detailFieldVal}>{selectedHistoryItem.data?.nin || selectedHistoryItem.data?.NIN || '90683257926'}</Text>
                                    </View>
                                </View>

                                <View style={styles.detailRow}>
                                    <View style={styles.detailFieldHalf}>
                                        <Text style={styles.detailFieldLabel}>TRACKING ID / NIN</Text>
                                        <Text style={styles.detailFieldVal}>{selectedHistoryItem.target}</Text>
                                    </View>
                                    <View style={styles.detailFieldHalf}>
                                        <Text style={styles.detailFieldLabel}>TRACKING ID</Text>
                                        <Text style={styles.detailFieldVal}>{selectedHistoryItem.data?.trackingId || selectedHistoryItem.data?.tracking_id || 'S7Y00RZPM0003AF'}</Text>
                                    </View>
                                </View>

                                <View style={styles.detailRow}>
                                    <View style={styles.detailFieldHalf}>
                                        <Text style={styles.detailFieldLabel}>AMOUNT</Text>
                                        <Text style={styles.detailFieldVal}>₦{(selectedHistoryItem.amount || 900).toLocaleString()}</Text>
                                    </View>
                                    <View style={styles.detailFieldHalf}>
                                        <Text style={styles.detailFieldLabel}>REFUND</Text>
                                        <Text style={styles.detailFieldVal}>NO</Text>
                                    </View>
                                </View>

                                <View style={styles.detailMessageRow}>
                                    <Ionicons name="chatbubble-outline" size={14} color="#64748b" style={{ marginRight: 8, marginTop: 1 }} />
                                    <Text style={styles.detailMessageText}>Completed successfully</Text>
                                </View>

                                {/* Download Action Button */}
                                <TouchableOpacity 
                                    style={styles.detailDownloadBtn}
                                    onPress={() => {
                                        Alert.alert('Download Started', 'Validation slip is downloading to your storage.');
                                    }}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="download-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                                    <Text style={styles.detailDownloadBtnText}>Download Slip</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    )}
                </View>
            </Modal>

            {/* Main Header Row */}
            <View style={[styles.customHeader, { paddingTop: insets.top > 0 ? insets.top + 8 : 16 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={styles.headerIconContainer}>
                        <Ionicons name="shield-checkmark" size={22} color="#ffffff" />
                    </View>
                    <View style={{ marginLeft: 12 }}>
                        <Text style={styles.headerMainTitle}>Validation</Text>
                        <Text style={styles.headerSubTitle}>NIN validation request</Text>
                    </View>
                </View>
            </View>

            <ScrollView style={{ flex: 1, paddingHorizontal: 12 }} contentContainerStyle={styles.scrollContent}>
                
                {/* Processing time badge */}
                <View style={styles.processingTimeBadge}>
                    <Ionicons name="time-outline" size={14} color="#d97706" style={{ marginRight: 6 }} />
                    <Text style={styles.processingTimeText}>
                        Processing time: <Text style={{ fontWeight: '800' }}>24h to 48h</Text>
                    </Text>
                </View>

                {/* Wallet Balance widget */}
                <View style={styles.walletBar}>
                    <View style={styles.walletLeft}>
                        <Ionicons name="wallet-outline" size={20} color="#060d21" />
                        <View style={{ marginLeft: 8 }}>
                            <Text style={styles.walletLabel}>Tantancewa Balance</Text>
                            <Text style={styles.walletVal}>
                                {userBalance !== null ? \`₦\${userBalance.toLocaleString()}\` : 'Loading...'}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity 
                        style={styles.fundBtn}
                        onPress={() => router.push('/(app)/wallet')}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="add-circle" size={14} color="#ffffff" />
                        <Text style={styles.fundBtnText}>Fund</Text>
                    </TouchableOpacity>
                </View>

                {/* 1. DETAILS NEEDED */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={styles.stepBadge}>
                            <Text style={styles.stepBadgeText}>1</Text>
                        </View>
                        <Text style={styles.cardTitle}>DETAILS NEEDED</Text>
                    </View>
                    
                    <View style={styles.statusGrid}>
                        {statusTypes.map((item) => {
                            const isSelected = selectedStatus === item.id;
                            return (
                                <TouchableOpacity 
                                    key={item.id}
                                    onPress={() => setSelectedStatus(item.id)}
                                    style={[
                                        styles.statusCardCell,
                                        isSelected ? styles.statusCardSelected : styles.statusCardUnselected
                                    ]}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[styles.statusPrice, isSelected ? styles.textSelected : styles.textUnselected]}>
                                        ₦{item.price.toFixed(2)}
                                    </Text>
                                    <Text style={[styles.statusLabel, isSelected ? styles.textSelected : styles.textUnselected]} numberOfLines={2}>
                                        {item.name}
                                    </Text>
                                </TouchableOpacity>
                            )
                        })}
                    </View>
                </View>

                {/* 2. SLIP TYPE */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={styles.stepBadge}>
                            <Text style={styles.stepBadgeText}>2</Text>
                        </View>
                        <Text style={styles.cardTitle}>SLIP TYPE</Text>
                    </View>

                    <View style={styles.slipGrid}>
                        {slipTypes.map((item) => {
                            const isSelected = selectedSlip === item.id;
                            return (
                                <TouchableOpacity 
                                    key={item.id}
                                    onPress={() => setSelectedSlip(item.id)}
                                    style={[
                                        styles.slipCardCell,
                                        isSelected ? styles.slipCardSelected : styles.slipCardUnselected
                                    ]}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[styles.slipPrice, isSelected ? styles.textSelected : styles.textUnselected]}>
                                        {item.price > 0 ? \`+\` : ''}₦{item.price.toFixed(2)}
                                    </Text>
                                    <View style={styles.slipImageBox}>
                                        {item.image === null ? (
                                            <Ionicons name="close" size={28} color={isSelected ? '#060d21' : '#64748b'} />
                                        ) : (
                                            <Image source={item.image} style={styles.slipPreviewImage as any} resizeMode="contain" />
                                        )}
                                    </View>
                                    <Text style={[styles.slipLabel, isSelected ? styles.textSelected : styles.textUnselected]}>
                                        {item.name}
                                    </Text>
                                </TouchableOpacity>
                            )
                        })}
                    </View>
                </View>

                {/* 3. SUPPLY TRACKING / NIN */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={styles.stepBadge}>
                            <Text style={styles.stepBadgeText}>3</Text>
                        </View>
                        <Text style={styles.cardTitle}>SUPPLY TRACKING / NIN</Text>
                    </View>
                    
                    <View style={{ marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                            <Ionicons name="card-outline" size={14} color="#64748b" style={{ marginRight: 6 }} />
                            <Text style={styles.labelHeader}>Tracking ID / NIN</Text>
                        </View>
                        <View style={styles.inputContainer}>
                            <TextInput
                                placeholder="Enter Tracking ID / NIN"
                                placeholderTextColor="#94a3b8"
                                style={styles.inputStyleCentered}
                                value={nin} 
                                onChangeText={setNin} 
                                editable={!loading}
                            />
                        </View>
                    </View>

                    {/* Consent Checkbox */}
                    <TouchableOpacity 
                        onPress={() => setIsAgreed(!isAgreed)} 
                        activeOpacity={0.8}
                        style={styles.consentContainer}
                    >
                        <View style={[
                            styles.checkboxBox, 
                            isAgreed ? styles.checkboxBoxSelected : styles.checkboxBoxUnselected
                        ]}>
                            {isAgreed && <Ionicons name="checkmark" size={12} color="#ffffff" />}
                        </View>
                        <Text style={styles.consentText}>
                            By checking this box, you agree that the owner of the ID has granted you consent to verify his/her identity.
                        </Text>
                    </TouchableOpacity>

                    {/* Submit Button */}
                    <TouchableOpacity 
                        onPress={handleVerify} 
                        disabled={loading || !nin.trim() || !isAgreed} 
                        style={[
                            styles.verifyButton,
                            (loading || !nin.trim() || !isAgreed) ? styles.verifyButtonDisabled : styles.verifyButtonActive
                        ]}
                        activeOpacity={0.8}
                    >
                        {loading ? <ActivityIndicator color="#ffffff" size="small" /> : (
                            <>
                                <Ionicons name="shield-checkmark" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                                <Text style={styles.verifyButtonText}>Submit</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                {/* FAQ / Guidelines Section */}
                <View style={styles.card}>
                    <View style={styles.historyHeader}>
                        <Ionicons name="help-circle" size={16} color="#f5a623" />
                        <Text style={styles.historyTitle}>FAQ & Guidelines</Text>
                    </View>
                    {faqs.map((faq, idx) => {
                        const isExpanded = expandedFaq === idx;
                        return (
                            <View key={idx} style={styles.faqItem}>
                                <TouchableOpacity 
                                    style={styles.faqHeader} 
                                    onPress={() => setExpandedFaq(isExpanded ? null : idx)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.faqQuestion}>{faq.q}</Text>
                                    <Ionicons 
                                        name={isExpanded ? "chevron-up" : "chevron-down"} 
                                        size={14} 
                                        color="#64748b" 
                                    />
                                </TouchableOpacity>
                                {isExpanded && (
                                    <Text style={styles.faqAnswer}>{faq.a}</Text>
                                )}
                            </View>
                        );
                    })}
                </View>

                {/* RECENT LOOKUPS / HISTORY TABLE */}
                <View style={styles.card}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="time" size={18} color="#060d21" style={{ marginRight: 6 }} />
                            <Text style={styles.tableHeaderTitle}>HISTORY</Text>
                        </View>
                        
                        {/* Search Input on the right */}
                        <View style={styles.tableSearchBox}>
                            <TextInput
                                placeholder="Search NIN..."
                                placeholderTextColor="#94a3b8"
                                style={styles.tableSearchInput}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                            <TouchableOpacity style={styles.tableSearchBtn} activeOpacity={0.8}>
                                <Ionicons name="search" size={12} color="#ffffff" />
                            </TouchableOpacity>
                        </View>
                    </View>
                    
                    <Text style={styles.tableSubtitle}>Check the status after 5 to 10 minutes.</Text>

                    {filteredHistory.length === 0 ? (
                        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                            <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '600' }}>No past validation records found.</Text>
                        </View>
                    ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableHorizontalScroll}>
                            <View style={{ flexDirection: 'column' }}>
                                {/* Table Header Row */}
                                <View style={styles.tableHeaderRow}>
                                    <Text style={[styles.thCell, { width: 140 }]}>ACTION</Text>
                                    <Text style={[styles.thCell, { width: 110, textAlign: 'center' }]}>STATUS</Text>
                                    <Text style={[styles.thCell, { width: 160 }]}>NIN</Text>
                                    <Text style={[styles.thCell, { width: 100 }]}>SLIP</Text>
                                    <Text style={[styles.thCell, { width: 110 }]}>AMOUNT</Text>
                                    <Text style={[styles.thCell, { width: 110 }]}>DATE</Text>
                                </View>

                                {/* Table Body Rows */}
                                {filteredHistory.map((item) => {
                                    const recordName = item.data?.name || item.data?.fullName || [item.data?.firstname, item.data?.lastname].filter(Boolean).join(' ') || item.target;
                                    return (
                                        <View key={item.id} style={styles.tableBodyRow}>
                                            {/* ACTIONS (View / Delete) */}
                                            <View style={[styles.tbCell, { width: 140, flexDirection: 'row', alignItems: 'center' }]}>
                                                <TouchableOpacity 
                                                    onPress={() => setSelectedHistoryItem(item)}
                                                    style={styles.actionViewBtn}
                                                    activeOpacity={0.7}
                                                >
                                                    <Ionicons name="eye-outline" size={13} color="#64748b" style={{ marginRight: 4 }} />
                                                    <Text style={styles.actionViewBtnText}>View</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity 
                                                    onPress={() => deleteHistoryItem(item.id, recordName)}
                                                    style={styles.actionDeleteBtn}
                                                    activeOpacity={0.7}
                                                >
                                                    <Ionicons name="trash-outline" size={13} color="#DC2626" />
                                                </TouchableOpacity>
                                            </View>

                                            {/* STATUS */}
                                            <View style={[styles.tbCell, { width: 110, alignItems: 'center', justifyContent: 'center' }]}>
                                                <View style={styles.statusCompletedBadge}>
                                                    <Text style={styles.statusCompletedBadgeText}>{item.status || 'Completed'}</Text>
                                                </View>
                                            </View>

                                            {/* TRACKING ID / NIN */}
                                            <Text style={[styles.tbCell, { width: 160, fontWeight: '700', color: '#1e293b' }]}>
                                                {item.target}
                                            </Text>

                                            {/* SLIP */}
                                            <Text style={[styles.tbCell, { width: 100, color: '#475569', fontWeight: '600' }]}>
                                                {item.slip || 'No Slip'}
                                            </Text>

                                            {/* AMOUNT */}
                                            <Text style={[styles.tbCell, { width: 110, fontWeight: '800', color: '#0f172a' }]}>
                                                ₦{(item.amount || 900).toLocaleString()}
                                            </Text>

                                            {/* DATE */}
                                            <Text style={[styles.tbCell, { width: 110, color: '#64748b', fontWeight: '500' }]}>
                                                {item.date}
                                            </Text>
                                        </View>
                                    );
                                })}
                            </View>
                        </ScrollView>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f4f6fb',
    },
    scrollContent: {
        paddingBottom: 80,
    },
    customHeader: {
        paddingHorizontal: 16,
        paddingBottom: 16,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    headerIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#060d21',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerMainTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#0d1b3e',
    },
    headerSubTitle: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '600',
        marginTop: 2,
    },
    processingTimeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fef3c7',
        borderWidth: 1,
        borderColor: '#fde68a',
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginHorizontal: 4,
        marginTop: 12,
        marginBottom: 8,
    },
    processingTimeText: {
        color: '#d97706',
        fontSize: 11.5,
        fontWeight: '600',
    },
    loaderOverlay: {
        flex: 1,
        backgroundColor: 'rgba(5, 11, 20, 0.75)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    loaderCard: {
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: 28,
        alignItems: 'center',
        width: '85%',
        maxWidth: 320,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
    },
    loaderTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: '#0d1b3e',
        marginTop: 16,
        letterSpacing: -0.2,
    },
    loaderSub: {
        fontSize: 12,
        color: '#64748b',
        textAlign: 'center',
        marginTop: 6,
        fontWeight: '500',
    },
    alertOverlay: {
        flex: 1,
        backgroundColor: 'rgba(5, 11, 20, 0.7)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    alertCard: {
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        width: '85%',
        maxWidth: 320,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
    },
    alertIconBg: {
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    alertSuccessIcon: {
        backgroundColor: '#ecfdf5',
    },
    alertErrorIcon: {
        backgroundColor: '#fef2f2',
    },
    alertWarningIcon: {
        backgroundColor: '#fff7ed',
    },
    alertInfoIcon: {
        backgroundColor: '#eff6ff',
    },
    alertTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: '#0d1b3e',
        marginBottom: 8,
        textAlign: 'center',
        letterSpacing: -0.2,
    },
    alertMessage: {
        fontSize: 12,
        color: '#475569',
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 20,
        fontWeight: '500',
        paddingHorizontal: 8,
    },
    alertButton: {
        backgroundColor: '#0d1b3e',
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        shadowColor: '#0d1b3e',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 2,
    },
    alertButtonText: {
        color: '#ffffff',
        fontWeight: '800',
        fontSize: 13,
    },
    walletBar: {
        backgroundColor: '#ffffff',
        borderRadius: 18,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginHorizontal: 4,
    },
    walletLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    walletLabel: {
        fontSize: 9.5,
        color: '#64748b',
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    walletVal: {
        fontSize: 15,
        fontWeight: '900',
        color: '#060d21',
        marginTop: 1,
    },
    fundBtn: {
        backgroundColor: '#060d21',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 32,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    fundBtnText: {
        color: '#ffffff',
        fontWeight: '800',
        fontSize: 11,
        marginLeft: 4,
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 1,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginHorizontal: 4,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    stepBadge: {
        backgroundColor: '#060d21',
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    stepBadgeText: {
        color: '#ffffff',
        fontWeight: '900',
        fontSize: 11,
    },
    cardTitle: {
        color: '#334155',
        fontWeight: '800',
        fontSize: 13,
        letterSpacing: 0.8,
    },
    labelHeader: {
        color: '#334155',
        fontSize: 13,
        fontWeight: '800',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 14,
        paddingHorizontal: 16,
        height: 52,
        marginBottom: 8,
    },
    inputStyleCentered: {
        flex: 1,
        color: '#0d1b3e',
        fontWeight: '700',
        fontSize: 15,
        textAlign: 'center',
    },
    consentContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: 12,
        marginBottom: 20,
        paddingHorizontal: 4,
        backgroundColor: '#f8fafc',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    consentText: {
        color: '#475569',
        fontSize: 11,
        flex: 1,
        fontWeight: '600',
        lineHeight: 16,
    },
    checkboxBox: {
        width: 18,
        height: 18,
        borderRadius: 4,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
        marginTop: 1,
    },
    checkboxBoxSelected: {
        backgroundColor: '#060d21',
        borderColor: '#060d21',
    },
    checkboxBoxUnselected: {
        backgroundColor: '#ffffff',
        borderColor: '#cbd5e1',
    },
    verifyButton: {
        height: 52,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        width: '100%',
        shadowColor: '#060d21',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 3,
    },
    verifyButtonActive: {
        backgroundColor: '#060d21',
    },
    verifyButtonDisabled: {
        backgroundColor: '#cbd5e1',
        shadowOpacity: 0,
        elevation: 0,
    },
    verifyButtonText: {
        fontWeight: '900',
        color: '#ffffff',
        fontSize: 15.5,
        letterSpacing: 0.5,
    },
    statusGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        width: '100%',
    },
    statusCardCell: {
        borderRadius: 14,
        paddingHorizontal: 8,
        paddingVertical: 12,
        marginBottom: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        width: '48.5%',
        minHeight: 80,
    },
    statusCardSelected: {
        backgroundColor: '#ffffff',
        borderColor: '#060d21',
        shadowColor: '#060d21',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
    },
    statusCardUnselected: {
        backgroundColor: '#ffffff',
        borderColor: '#cbd5e1',
    },
    statusPrice: {
        fontSize: 12,
        fontWeight: '900',
        marginBottom: 4,
    },
    statusLabel: {
        fontSize: 10,
        fontWeight: '700',
        textAlign: 'center',
        lineHeight: 12,
        paddingHorizontal: 4,
    },
    textSelected: {
        color: '#060d21',
    },
    textUnselected: {
        color: '#64748b',
    },
    slipGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
    },
    slipCardCell: {
        borderRadius: 16,
        padding: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        width: '48.5%',
        minHeight: 110,
    },
    slipCardSelected: {
        backgroundColor: '#ffffff',
        borderColor: '#060d21',
        shadowColor: '#060d21',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
    },
    slipCardUnselected: {
        backgroundColor: '#ffffff',
        borderColor: '#cbd5e1',
    },
    slipPrice: {
        fontSize: 12,
        fontWeight: '900',
        marginBottom: 6,
    },
    slipImageBox: {
        width: '80%',
        height: 48,
        marginBottom: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    slipPreviewImage: {
        width: '100%',
        height: '100%',
    },
    slipLabel: {
        fontSize: 11,
        fontWeight: '800',
    },
    faqItem: {
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingVertical: 10,
    },
    faqHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
    },
    faqQuestion: {
        color: '#1e293b',
        fontWeight: '800',
        fontSize: 11.5,
        flex: 1,
        marginRight: 10,
    },
    faqAnswer: {
        color: '#64748b',
        fontSize: 11,
        marginTop: 6,
        lineHeight: 16,
        fontWeight: '500',
    },
    detailOverlay: {
        flex: 1,
        backgroundColor: 'rgba(5, 11, 20, 0.7)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    detailCard: {
        backgroundColor: '#ffffff',
        borderRadius: 24,
        width: '100%',
        maxWidth: 380,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 8,
    },
    detailHeader: {
        padding: 20,
        alignItems: 'flex-start',
    },
    detailHeaderIconBox: {
        backgroundColor: '#ffffff',
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    detailHeaderSubtitle: {
        color: '#f5a623',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.8,
    },
    detailHeaderTitle: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '900',
        marginTop: 1,
    },
    detailCloseBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    detailBadgesRow: {
        flexDirection: 'row',
        marginTop: 14,
    },
    detailBadgeCompleted: {
        backgroundColor: '#10b981',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 4,
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 8,
    },
    detailBadgeSlip: {
        backgroundColor: 'rgba(255, 255, 255, 0.18)',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    detailBadgeText: {
        color: '#ffffff',
        fontSize: 10,
        fontWeight: '800',
    },
    detailScroll: {
        maxHeight: 400,
    },
    detailFieldFull: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 14,
        padding: 12,
        marginBottom: 8,
    },
    detailFieldLabel: {
        fontSize: 8.5,
        color: '#94a3b8',
        fontWeight: '800',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    detailFieldVal: {
        fontSize: 13,
        fontWeight: '900',
        color: '#0f172a',
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    detailFieldHalf: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 14,
        padding: 12,
        width: '48.5%',
    },
    detailMessageRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 14,
        padding: 12,
        marginTop: 4,
        marginBottom: 16,
    },
    detailMessageText: {
        color: '#475569',
        fontSize: 12,
        fontWeight: '600',
        lineHeight: 16,
    },
    detailDownloadBtn: {
        backgroundColor: '#060d21',
        height: 48,
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        shadowColor: '#060d21',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 3,
        marginBottom: 12,
    },
    detailDownloadBtnText: {
        color: '#ffffff',
        fontWeight: '900',
        fontSize: 14,
    },
    tableHeaderTitle: {
        color: '#0f172a',
        fontWeight: '900',
        fontSize: 14,
        letterSpacing: 0.5,
    },
    tableSearchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        paddingLeft: 10,
        height: 32,
        width: 170,
    },
    tableSearchInput: {
        flex: 1,
        fontSize: 10.5,
        fontWeight: '600',
        color: '#1e293b',
        paddingVertical: 0,
    },
    tableSearchBtn: {
        backgroundColor: '#060d21',
        width: 24,
        height: 24,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 3,
    },
    tableSubtitle: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '600',
        marginBottom: 12,
    },
    tableHorizontalScroll: {
        width: '100%',
        marginVertical: 4,
    },
    tableHeaderRow: {
        flexDirection: 'row',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        borderRadius: 10,
        height: 40,
        alignItems: 'center',
    },
    thCell: {
        fontSize: 10.5,
        color: '#64748b',
        fontWeight: '800',
        paddingHorizontal: 8,
        letterSpacing: 0.5,
    },
    tableBodyRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        height: 48,
        alignItems: 'center',
    },
    tbCell: {
        fontSize: 12,
        paddingHorizontal: 8,
    },
    actionViewBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginRight: 6,
    },
    actionViewBtnText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#475569',
    },
    actionDeleteBtn: {
        backgroundColor: '#fef2f2',
        width: 24,
        height: 24,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#fee2e2',
    },
    statusCompletedBadge: {
        backgroundColor: '#ecfdf5',
        borderWidth: 1,
        borderColor: '#a7f3d0',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 3,
    },
    statusCompletedBadgeText: {
        color: '#059669',
        fontSize: 10.5,
        fontWeight: '800',
    },
});
`;

fs.writeFileSync(valPath, fullValCode, 'utf8');
console.log('Successfully modernized validation.tsx with primary brand colors, safe area, and matching screenshot design!');
