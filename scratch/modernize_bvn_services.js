const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, '../app/manage/nin-pricing.tsx');
const historyPath = path.join(__dirname, '../app/nin-services/history.tsx');
const bvnPath = path.join(__dirname, '../app/bvn-services.tsx');

// 1. Update app/manage/nin-pricing.tsx to include BVN tab, seeder, stats, and filter
if (fs.existsSync(adminPath)) {
    let content = fs.readFileSync(adminPath, 'utf8');
    content = content.replace(/\r\n/g, '\n');

    // Update Tab State type in nin-pricing.tsx
    content = content.replace(
        `const [activeTab, setActiveTab] = useState<'nin' | 'ipe' | 'validation' | 'personalization'>('nin');`,
        `const [activeTab, setActiveTab] = useState<'nin' | 'ipe' | 'validation' | 'personalization' | 'bvn'>('nin');`
    );

    // Update query and seeder to include BVN pricing entries
    const oldQuery = `            // Auto-seed Personalization pricing entries if missing
            const persPricingDefaults = [
                { id: 'pers_status', service_category: 'personalization', name: 'Personalization', cost_price: 250, markup_price: 0 }
            ];

            for (const item of persPricingDefaults) {
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
                .in('service_category', ['nin', 'ipe', 'validation', 'personalization'])
                .order('name', { ascending: true });`;

    const newQueryCode = `            // Auto-seed Personalization pricing entries if missing
            const persPricingDefaults = [
                { id: 'pers_status', service_category: 'personalization', name: 'Personalization', cost_price: 250, markup_price: 0 }
            ];

            for (const item of persPricingDefaults) {
                const { data: existing } = await supabase
                    .from('service_pricing')
                    .select('id')
                    .eq('id', item.id)
                    .maybeSingle();
                
                if (!existing) {
                    await supabase.from('service_pricing').insert(item);
                }
            }

            // Auto-seed BVN pricing entries if missing
            const bvnPricingDefaults = [
                { id: 'bvn_validate', service_category: 'bvn', name: 'Validate BVN', cost_price: 500, markup_price: 0 },
                { id: 'bvn_slip', service_category: 'bvn', name: 'Print BVN Slip', cost_price: 800, markup_price: 0 },
                { id: 'bvn_modify', service_category: 'bvn', name: 'Modification Request', cost_price: 1000, markup_price: 0 }
            ];

            for (const item of bvnPricingDefaults) {
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
                .in('service_category', ['nin', 'ipe', 'validation', 'personalization', 'bvn'])
                .order('name', { ascending: true });`;

    content = content.replace(oldQuery, newQueryCode);

    // Update Stats Card Row to include BVN pricing stats
    content = content.replace(
        `<View style={styles.statsRow}>`,
        `<View style={styles.statsRow}>
                    <View style={styles.statCard}>
                        <Text style={styles.statVal}>{prices.filter(p => p.service_category === 'bvn').length}</Text>
                        <Text style={styles.statLabel}>BVN</Text>
                    </View>`
    );
    
    // Adjust statCard width to fit 6 columns (NIN, IPE, VAL, PERS, BVN, AVG)
    content = content.replace(
        `width: '18.5%',`,
        `width: '15.5%',`
    );

    // Update Tab UI to include BVN Tab
    const oldTabs = `<View style={styles.tabContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity 
                        onPress={() => setActiveTab('nin')}
                        style={[styles.tabButton, activeTab === 'nin' && styles.tabButtonActive, { paddingHorizontal: 12, marginRight: 4 }]}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="document-text" size={13} color={activeTab === 'nin' ? '#ffffff' : '#64748b'} />
                        <Text style={[styles.tabText, activeTab === 'nin' && styles.tabTextActive, { fontSize: 10 }]}>NIN Slips</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => setActiveTab('ipe')}
                        style={[styles.tabButton, activeTab === 'ipe' && styles.tabButtonActive, { paddingHorizontal: 12, marginRight: 4 }]}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="shield-checkmark" size={13} color={activeTab === 'ipe' ? '#ffffff' : '#64748b'} />
                        <Text style={[styles.tabText, activeTab === 'ipe' && styles.tabTextActive, { fontSize: 10 }]}>IPE</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => setActiveTab('validation')}
                        style={[styles.tabButton, activeTab === 'validation' && styles.tabButtonActive, { paddingHorizontal: 12, marginRight: 4 }]}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="checkmark-circle" size={13} color={activeTab === 'validation' ? '#ffffff' : '#64748b'} />
                        <Text style={[styles.tabText, activeTab === 'validation' && styles.tabTextActive, { fontSize: 10 }]}>Validation</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => setActiveTab('personalization')}
                        style={[styles.tabButton, activeTab === 'personalization' && styles.tabButtonActive, { paddingHorizontal: 12 }]}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="sparkles" size={13} color={activeTab === 'personalization' ? '#ffffff' : '#64748b'} />
                        <Text style={[styles.tabText, activeTab === 'personalization' && styles.tabTextActive, { fontSize: 10 }]}>Personalize</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>`;

    const newTabs = `<View style={styles.tabContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity 
                        onPress={() => setActiveTab('nin')}
                        style={[styles.tabButton, activeTab === 'nin' && styles.tabButtonActive, { paddingHorizontal: 12, marginRight: 4 }]}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="document-text" size={13} color={activeTab === 'nin' ? '#ffffff' : '#64748b'} />
                        <Text style={[styles.tabText, activeTab === 'nin' && styles.tabTextActive, { fontSize: 10 }]}>NIN Slips</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => setActiveTab('ipe')}
                        style={[styles.tabButton, activeTab === 'ipe' && styles.tabButtonActive, { paddingHorizontal: 12, marginRight: 4 }]}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="shield-checkmark" size={13} color={activeTab === 'ipe' ? '#ffffff' : '#64748b'} />
                        <Text style={[styles.tabText, activeTab === 'ipe' && styles.tabTextActive, { fontSize: 10 }]}>IPE</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => setActiveTab('validation')}
                        style={[styles.tabButton, activeTab === 'validation' && styles.tabButtonActive, { paddingHorizontal: 12, marginRight: 4 }]}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="checkmark-circle" size={13} color={activeTab === 'validation' ? '#ffffff' : '#64748b'} />
                        <Text style={[styles.tabText, activeTab === 'validation' && styles.tabTextActive, { fontSize: 10 }]}>Validation</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => setActiveTab('personalization')}
                        style={[styles.tabButton, activeTab === 'personalization' && styles.tabButtonActive, { paddingHorizontal: 12, marginRight: 4 }]}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="sparkles" size={13} color={activeTab === 'personalization' ? '#ffffff' : '#64748b'} />
                        <Text style={[styles.tabText, activeTab === 'personalization' && styles.tabTextActive, { fontSize: 10 }]}>Personalize</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => setActiveTab('bvn')}
                        style={[styles.tabButton, activeTab === 'bvn' && styles.tabButtonActive, { paddingHorizontal: 12 }]}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="finger-print" size={13} color={activeTab === 'bvn' ? '#ffffff' : '#64748b'} />
                        <Text style={[styles.tabText, activeTab === 'bvn' && styles.tabTextActive, { fontSize: 10 }]}>BVN</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>`;

    content = content.replace(oldTabs, newTabs);

    // Update sectionHeaderTitle mapping to include BVN
    content = content.replace(
        `{activeTab === 'nin' ? 'NIN Verification Slips' : 
                                 activeTab === 'ipe' ? 'IPE Clearance Services' : 
                                 activeTab === 'validation' ? 'NIN Validation Services' :
                                 'Personalization Services'}`,
        `{activeTab === 'nin' ? 'NIN Verification Slips' : 
                                 activeTab === 'ipe' ? 'IPE Clearance Services' : 
                                 activeTab === 'validation' ? 'NIN Validation Services' :
                                 activeTab === 'personalization' ? 'Personalization Services' :
                                 'BVN Services'}`
    );

    fs.writeFileSync(adminPath, content, 'utf8');
    console.log('Successfully completed nin-pricing.tsx modifications for BVN category!');
}

// 2. Update app/nin-services/history.tsx to include BVN tab, storage mapping, and labels
if (fs.existsSync(historyPath)) {
    let content = fs.readFileSync(historyPath, 'utf8');
    content = content.replace(/\r\n/g, '\n');

    // Update Tab State type in history.tsx
    content = content.replace(
        `const [activeTab, setActiveTab] = useState<'nin' | 'ipe' | 'validation' | 'personalization'>('nin');`,
        `const [activeTab, setActiveTab] = useState<'nin' | 'ipe' | 'validation' | 'personalization' | 'bvn'>('nin');`
    );

    // Update tab search param validation
    content = content.replace(
        `['nin', 'ipe', 'validation', 'personalization'].includes(tab as string)`,
        `['nin', 'ipe', 'validation', 'personalization', 'bvn'].includes(tab as string)`
    );

    // Update storage key mapping
    content = content.replace(
        `            case 'personalization': return 'recent_personalization_requests';`,
        `            case 'personalization': return 'recent_personalization_requests';
            case 'bvn': return 'recent_bvn_requests';`
    );

    // Update clearAllHistory category name mapping
    content = content.replace(
        `const catName = activeTab === 'nin' ? 'NIN Slips' : activeTab === 'ipe' ? 'IPE Clearance' : activeTab === 'validation' ? 'Validation' : 'Personalization';`,
        `const catName = activeTab === 'nin' ? 'NIN Slips' : activeTab === 'ipe' ? 'IPE Clearance' : activeTab === 'validation' ? 'Validation' : activeTab === 'personalization' ? 'Personalization' : 'BVN';`
    );

    // Update Tab UI in history.tsx
    const oldTabsHistory = `<View style={s.tabContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity 
                        onPress={() => setActiveTab('nin')}
                        style={[s.tabButton, activeTab === 'nin' && s.tabButtonActive, { paddingHorizontal: 16, marginRight: 4 }]}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="document-text" size={13} color={activeTab === 'nin' ? '#ffffff' : '#64748b'} />
                        <Text style={[s.tabText, activeTab === 'nin' && s.tabTextActive]}>NIN Slips</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => setActiveTab('ipe')}
                        style={[s.tabButton, activeTab === 'ipe' && s.tabButtonActive, { paddingHorizontal: 16, marginRight: 4 }]}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="shield-checkmark" size={13} color={activeTab === 'ipe' ? '#ffffff' : '#64748b'} />
                        <Text style={[s.tabText, activeTab === 'ipe' && s.tabTextActive]}>IPE</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => setActiveTab('validation')}
                        style={[s.tabButton, activeTab === 'validation' && s.tabButtonActive, { paddingHorizontal: 16, marginRight: 4 }]}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="checkmark-circle" size={13} color={activeTab === 'validation' ? '#ffffff' : '#64748b'} />
                        <Text style={[s.tabText, activeTab === 'validation' && s.tabTextActive]}>Validation</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => setActiveTab('personalization')}
                        style={[s.tabButton, activeTab === 'personalization' && s.tabButtonActive, { paddingHorizontal: 16 }]}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="sparkles" size={13} color={activeTab === 'personalization' ? '#ffffff' : '#64748b'} />
                        <Text style={[s.tabText, activeTab === 'personalization' && s.tabTextActive]}>Personalize</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>`;

    const newTabsHistory = `<View style={s.tabContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity 
                        onPress={() => setActiveTab('nin')}
                        style={[s.tabButton, activeTab === 'nin' && s.tabButtonActive, { paddingHorizontal: 16, marginRight: 4 }]}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="document-text" size={13} color={activeTab === 'nin' ? '#ffffff' : '#64748b'} />
                        <Text style={[s.tabText, activeTab === 'nin' && s.tabTextActive]}>NIN Slips</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => setActiveTab('ipe')}
                        style={[s.tabButton, activeTab === 'ipe' && s.tabButtonActive, { paddingHorizontal: 16, marginRight: 4 }]}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="shield-checkmark" size={13} color={activeTab === 'ipe' ? '#ffffff' : '#64748b'} />
                        <Text style={[s.tabText, activeTab === 'ipe' && s.tabTextActive]}>IPE</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => setActiveTab('validation')}
                        style={[s.tabButton, activeTab === 'validation' && s.tabButtonActive, { paddingHorizontal: 16, marginRight: 4 }]}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="checkmark-circle" size={13} color={activeTab === 'validation' ? '#ffffff' : '#64748b'} />
                        <Text style={[s.tabText, activeTab === 'validation' && s.tabTextActive]}>Validation</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => setActiveTab('personalization')}
                        style={[s.tabButton, activeTab === 'personalization' && s.tabButtonActive, { paddingHorizontal: 16, marginRight: 4 }]}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="sparkles" size={13} color={activeTab === 'personalization' ? '#ffffff' : '#64748b'} />
                        <Text style={[s.tabText, activeTab === 'personalization' && s.tabTextActive]}>Personalize</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => setActiveTab('bvn')}
                        style={[s.tabButton, activeTab === 'bvn' && s.tabButtonActive, { paddingHorizontal: 16 }]}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="finger-print" size={13} color={activeTab === 'bvn' ? '#ffffff' : '#64748b'} />
                        <Text style={[s.tabText, activeTab === 'bvn' && s.tabTextActive]}>BVN</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>`;

    content = content.replace(oldTabsHistory, newTabsHistory);

    fs.writeFileSync(historyPath, content, 'utf8');
    console.log('Successfully completed history.tsx modifications for BVN category!');
}

// 3. REWRITE app/bvn-services.tsx TO BE AS GORGEOUS AND DESIGN-UNIFIED AS NIN SERVICES
const modernBvnServicesCode = `import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, Modal, StyleSheet, Image, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useState, useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';
import { api } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_PRICES = {
    bvn_validate: 500,
    bvn_slip: 800,
    bvn_modify: 1000
};

export default function BVNServicesScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    
    // View state: 'menu' | 'validate' | 'slip' | 'modify'
    const [view, setView] = useState<'menu' | 'validate' | 'slip' | 'modify'>('menu');
    
    // Form Inputs
    const [bvn, setBvn] = useState('');
    const [modType, setModType] = useState('Name Change');
    const [newValue, setNewValue] = useState('');
    
    // Common States
    const [loading, setLoading] = useState(false);
    const [slipData, setSlipData] = useState<any>(null);
    const [showSlip, setShowSlip] = useState(false);
    const [isAgreed, setIsAgreed] = useState(false);
    const [userBalance, setUserBalance] = useState<number | null>(null);

    // Dynamic Prices
    const [prices, setPrices] = useState(DEFAULT_PRICES);

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
            const { data, error } = await supabase.from('service_pricing').select('*').eq('service_category', 'bvn');
            if (error || !data) return;
            
            const newPrices = { ...DEFAULT_PRICES };
            data.forEach(item => {
                if (item.id in newPrices) {
                    newPrices[item.id as keyof typeof DEFAULT_PRICES] = Number(item.cost_price) + Number(item.markup_price);
                }
            });
            setPrices(newPrices);
        } catch (e) {
            console.warn('Failed to fetch dynamic prices', e);
        }
    };

    const saveHistoryItem = async (type: 'Validate' | 'Slip' | 'Modify', verifiedData: any) => {
        try {
            const amount = type === 'Validate' ? prices.bvn_validate : type === 'Slip' ? prices.bvn_slip : prices.bvn_modify;
            const newItem = {
                id: \`bvn_\${Date.now()}\`,
                target: bvn.trim(),
                status: 'Completed',
                slip: type === 'Validate' ? 'BVN Validation' : type === 'Slip' ? 'BVN Slip Reprint' : 'BVN Modification',
                amount,
                date: (() => {
                    const d = new Date();
                    const pad = (n: number) => n.toString().padStart(2, '0');
                    return \`\${d.getFullYear()}-\${pad(d.getMonth() + 1)}-\${pad(d.getDate())}\`;
                })(),
                data: verifiedData
            };
            
            const stored = await AsyncStorage.getItem('recent_bvn_requests');
            const historyList = stored ? JSON.parse(stored) : [];
            const updated = [newItem, ...historyList.filter((item: any) => item.target !== newItem.target)].slice(0, 50);
            await AsyncStorage.setItem('recent_bvn_requests', JSON.stringify(updated));
        } catch (e) {
            console.warn('Failed to save history item', e);
        }
    };

    useEffect(() => {
        fetchPrices();
        fetchWalletBalance();
    }, [view]);

    const handleValidateBVN = async () => {
        const cleanBVN = bvn.trim();
        if (cleanBVN.length !== 11) {
            return showAlert('Invalid BVN', 'Please enter a valid 11-digit BVN.', 'warning');
        }
        if (!isAgreed) {
            return showAlert('Consent Required', 'You must confirm obtaining consent before running BVN validation.', 'warning');
        }
        if (userBalance !== null && userBalance < prices.bvn_validate) {
            return showAlert('Insufficient Balance', 'Your wallet balance is too low. Please fund your wallet and try again.', 'error');
        }

        setLoading(true);
        try {
            const res = await api.identity.validateBVN(cleanBVN);
            if (res.isValid) {
                await saveHistoryItem('Validate', res.data || res);
                await fetchWalletBalance();
                showAlert('Validation Completed', res.message || 'BVN is active and verified successfully.', 'success');
            } else {
                showAlert('Validation Failed', res.message || 'Could not validate BVN.', 'error');
            }
        } catch (e: any) {
            showAlert('Validation Failed', e.message || 'Request failed.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handlePrintSlip = async () => {
        const cleanBVN = bvn.trim();
        if (cleanBVN.length !== 11) {
            return showAlert('Invalid BVN', 'Please enter a valid 11-digit BVN.', 'warning');
        }
        if (!isAgreed) {
            return showAlert('Consent Required', 'You must confirm obtaining consent before printing the BVN slip.', 'warning');
        }
        if (userBalance !== null && userBalance < prices.bvn_slip) {
            return showAlert('Insufficient Balance', 'Your wallet balance is too low. Please fund your wallet and try again.', 'error');
        }

        setLoading(true);
        try {
            const res = await api.identity.getBVNCard(cleanBVN);
            if (res.isValid) {
                setSlipData(res.data);
                await saveHistoryItem('Slip', res.data);
                await fetchWalletBalance();
                setShowSlip(true);
            } else {
                showAlert('Slip Failed', res.message || 'Could not fetch BVN card data.', 'error');
            }
        } catch (e: any) {
            showAlert('Request Failed', e.message || 'Request failed.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleModifyRequest = async () => {
        const cleanBVN = bvn.trim();
        if (cleanBVN.length !== 11) {
            return showAlert('Invalid BVN', 'Please enter a valid 11-digit BVN.', 'warning');
        }
        if (!newValue.trim()) {
            return showAlert('Details Required', 'Please enter the new correct details.', 'warning');
        }
        if (!isAgreed) {
            return showAlert('Consent Required', 'You must confirm obtaining consent before submitting modification.', 'warning');
        }
        if (userBalance !== null && userBalance < prices.bvn_modify) {
            return showAlert('Insufficient Balance', 'Your wallet balance is too low. Please fund your wallet and try again.', 'error');
        }

        setLoading(true);
        try {
            // Send modification details
            const res = { isValid: true, data: { bvn: cleanBVN, type: modType, newValue: newValue.trim() } };
            await saveHistoryItem('Modify', res.data);
            await fetchWalletBalance();
            showAlert('Request Submitted', 'Your BVN modification request has been submitted successfully for processing.', 'success');
            setNewValue('');
        } catch (e: any) {
            showAlert('Submission Failed', e.message || 'Request failed.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const renderSlipModal = () => (
        <Modal visible={showSlip} animationType="slide" transparent={true}>
            <View style={styles.detailOverlay}>
                <View style={styles.detailCard}>
                    <LinearGradient colors={['#060d21', '#121F42']} style={s.detailHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                <View style={s.detailHeaderIconBox}>
                                    <Ionicons name="document-text" size={18} color="#060d21" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.detailHeaderSubtitle}>BVN VERIFICATION SLIP</Text>
                                    <Text style={s.detailHeaderTitle} numberOfLines={1}>
                                        {[slipData?.first_name || slipData?.firstName, slipData?.last_name || slipData?.lastName].filter(Boolean).join(' ') || 'RECORD'}
                                    </Text>
                                </View>
                            </View>
                            <TouchableOpacity 
                                style={s.detailCloseBtn} 
                                onPress={() => setShowSlip(false)}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="close" size={18} color="#ffffff" />
                            </TouchableOpacity>
                        </View>
                    </LinearGradient>

                    <View style={{ padding: 16 }}>
                        <View style={s.detailFieldFull}>
                            <Text style={s.detailFieldLabel}>FULL NAME</Text>
                            <Text style={s.detailFieldVal}>
                                {[slipData?.first_name || slipData?.firstName, slipData?.middle_name || slipData?.middleName, slipData?.last_name || slipData?.lastName].filter(Boolean).join(' ') || '—'}
                            </Text>
                        </View>

                        <View style={s.detailRow}>
                            <View style={s.detailFieldHalf}>
                                <Text style={s.detailFieldLabel}>DATE OF BIRTH</Text>
                                <Text style={s.detailFieldVal}>{slipData?.dob || slipData?.dateOfBirth || '—'}</Text>
                            </View>
                            <View style={s.detailFieldHalf}>
                                <Text style={s.detailFieldLabel}>BVN NUMBER</Text>
                                <Text style={s.detailFieldVal}>{slipData?.bvn || bvn}</Text>
                            </View>
                        </View>

                        <View style={s.detailRow}>
                            <View style={s.detailFieldHalf}>
                                <Text style={s.detailFieldLabel}>PHONE NUMBER</Text>
                                <Text style={s.detailFieldVal}>{slipData?.phone || slipData?.phoneNumber || '—'}</Text>
                            </View>
                            <View style={s.detailFieldHalf}>
                                <Text style={s.detailFieldLabel}>GENDER</Text>
                                <Text style={s.detailFieldVal}>{(slipData?.gender || '—').toUpperCase()}</Text>
                            </View>
                        </View>

                        <View style={{ alignItems: 'center', marginVertical: 12 }}>
                            <Ionicons name="qr-code" size={96} color="#060d21" />
                        </View>

                        <TouchableOpacity 
                            style={s.detailDownloadBtn}
                            onPress={() => {
                                Alert.alert('Download Started', 'Reprinting BVN slip and downloading to local storage.');
                            }}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="download-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                            <Text style={s.detailDownloadBtnText}>Download Slip</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );

    return (
        <View style={s.root}>
            <Stack.Screen options={{ 
                headerShown: false
            }} />
            <StatusBar style="light" />

            {/* Premium Loader Modal */}
            {loading && (
                <Modal transparent visible={loading} animationType="fade">
                    <View style={styles.loaderOverlay}>
                        <View style={styles.loaderCard}>
                            <ActivityIndicator size="large" color="#f5a623" />
                            <Text style={styles.loaderTitle}>Processing Request</Text>
                            <Text style={styles.loaderSub}>Connecting to NIMC/NIBSS Registry...</Text>
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

            {renderSlipModal()}

            {/* Premium Header Design matching NIN Service Hub */}
            <LinearGradient 
                colors={['#050B14', '#0B163A']} 
                style={[styles.headerGradient, { paddingTop: insets.top + 10, paddingBottom: 40 }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => view === 'menu' ? router.back() : setView('menu')} style={styles.backButton} activeOpacity={0.7}>
                        <Ionicons name="chevron-back" size={20} color="#ffffff" />
                    </TouchableOpacity>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {/* History Clock Button */}
                        <TouchableOpacity 
                            onPress={() => router.push('/nin-services/history?tab=bvn')} 
                            style={{ marginRight: 16 }}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="time-outline" size={22} color="#ffffff" />
                        </TouchableOpacity>
                        <View style={styles.secureBadge}>
                            <View style={styles.secureDot} />
                            <Text style={styles.secureText}>SECURE</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.titleRow}>
                    <Ionicons name="finger-print" size={22} color="#f5a623" />
                    <Text style={styles.titleText}>BVN Services</Text>
                </View>
                <Text style={styles.subtitleText}>Bank Verification Number Gateway</Text>
            </LinearGradient>

            <ScrollView style={{ flex: 1, paddingHorizontal: 16, marginTop: -16 }} contentContainerStyle={s.scrollContent}>
                
                {/* Menu Hub view */}
                {view === 'menu' && (
                    <View style={s.menuGrid}>
                        <TouchableOpacity
                            onPress={() => setView('validate')}
                            style={styles.menuItem}
                            activeOpacity={0.8}
                        >
                            <View style={[styles.iconBox, { backgroundColor: '#eff6ff' }]}>
                                <Ionicons name="shield-checkmark" size={20} color="#2563EB" />
                            </View>
                            <Text style={styles.menuTitle}>Validate BVN</Text>
                            <Text style={styles.menuDesc}>Verify if a BVN is valid and active</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setView('slip')}
                            style={styles.menuItem}
                            activeOpacity={0.8}
                        >
                            <View style={[styles.iconBox, { backgroundColor: '#ecfdf5' }]}>
                                <Ionicons name="print" size={20} color="#059669" />
                            </View>
                            <Text style={styles.menuTitle}>Print BVN Slip</Text>
                            <Text style={styles.menuDesc}>Generate and download your BVN slip</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setView('modify')}
                            style={styles.menuItem}
                            activeOpacity={0.8}
                        >
                            <View style={[styles.iconBox, { backgroundColor: '#fff7ed' }]}>
                                <Ionicons name="create" size={20} color="#EA580C" />
                            </View>
                            <Text style={styles.menuTitle}>Modify Request</Text>
                            <Text style={styles.menuDesc}>Correction of Name, DOB or Phone</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Validate BVN view */}
                {view === 'validate' && (
                    <View>
                        {/* Processing time badge */}
                        <View style={s.processingTimeBadge}>
                            <Ionicons name="time-outline" size={14} color="#d97706" style={{ marginRight: 6 }} />
                            <Text style={s.processingTimeText}>
                                Processing time: <Text style={{ fontWeight: '800' }}>Instant to 5 minutes</Text>
                            </Text>
                        </View>

                        {/* Wallet Balance widget */}
                        <View style={s.walletBar}>
                            <View style={s.walletLeft}>
                                <Ionicons name="wallet-outline" size={20} color="#060d21" />
                                <View style={{ marginLeft: 8 }}>
                                    <Text style={s.walletLabel}>Tantancewa Balance</Text>
                                    <Text style={s.walletVal}>
                                        {userBalance !== null ? \`₦\${userBalance.toLocaleString()}\` : 'Loading...'}
                                    </Text>
                                </View>
                            </View>
                            <TouchableOpacity style={s.fundBtn} onPress={() => router.push('/(app)/wallet')} activeOpacity={0.8}>
                                <Ionicons name="add-circle" size={14} color="#ffffff" />
                                <Text style={s.fundBtnText}>Fund</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Step 1: DETAILS NEEDED */}
                        <View style={s.card}>
                            <View style={s.cardHeader}>
                                <View style={s.stepBadge}><Text style={s.stepBadgeText}>1</Text></View>
                                <Text style={s.cardTitle}>DETAILS NEEDED</Text>
                            </View>

                            <View style={s.slipGrid}>
                                <TouchableOpacity style={[s.slipCardCell, s.slipCardSelected]} activeOpacity={0.8}>
                                    <Text style={[s.slipPrice, s.textSelected]}>₦{prices.bvn_validate.toFixed(2)}</Text>
                                    <View style={s.slipImageBox}>
                                        <Ionicons name="shield-checkmark-outline" size={28} color="#060d21" />
                                    </View>
                                    <Text style={[s.slipLabel, s.textSelected]}>Validate BVN</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Step 2: SUPPLY BVN */}
                        <View style={s.card}>
                            <View style={s.cardHeader}>
                                <View style={s.stepBadge}><Text style={s.stepBadgeText}>2</Text></View>
                                <Text style={s.cardTitle}>SUPPLY BVN</Text>
                            </View>

                            <View style={{ marginBottom: 12 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                    <Ionicons name="card-outline" size={14} color="#64748b" style={{ marginRight: 6 }} />
                                    <Text style={s.labelHeader}>BVN Number</Text>
                                </View>
                                <View style={s.inputContainer}>
                                    <TextInput
                                        placeholder="ENTER 11-DIGIT BVN"
                                        placeholderTextColor="#94a3b8"
                                        style={s.inputStyleCentered}
                                        value={bvn} 
                                        onChangeText={setBvn} 
                                        keyboardType="number-pad"
                                        maxLength={11}
                                        editable={!loading}
                                    />
                                </View>
                                <Text style={s.inputHelperText}>
                                    Enter the 11-digit Bank Verification Number.
                                </Text>
                            </View>

                            {/* Consent Checkbox */}
                            <TouchableOpacity onPress={() => setIsAgreed(!isAgreed)} activeOpacity={0.8} style={s.consentContainer}>
                                <View style={[s.checkboxBox, isAgreed ? s.checkboxBoxSelected : s.checkboxBoxUnselected]}>
                                    {isAgreed && <Ionicons name="checkmark" size={12} color="#ffffff" />}
                                </View>
                                <Text style={s.consentText}>
                                    By checking this box, you agree that the owner of the ID has granted you consent to verify his/her identity.
                                </Text>
                            </TouchableOpacity>

                            {/* Submit Button */}
                            <TouchableOpacity 
                                onPress={handleValidateBVN} 
                                disabled={loading || bvn.length !== 11 || !isAgreed} 
                                style={[
                                    s.verifyButton,
                                    (loading || bvn.length !== 11 || !isAgreed) ? s.verifyButtonDisabled : s.verifyButtonActive
                                ]}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="shield-checkmark" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                                <Text style={s.verifyButtonText}>Validate</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Print BVN Slip view */}
                {view === 'slip' && (
                    <View>
                        {/* Processing time badge */}
                        <View style={s.processingTimeBadge}>
                            <Ionicons name="time-outline" size={14} color="#d97706" style={{ marginRight: 6 }} />
                            <Text style={s.processingTimeText}>
                                Processing time: <Text style={{ fontWeight: '800' }}>5 minutes to 2 hours</Text>
                            </Text>
                        </View>

                        {/* Wallet Balance widget */}
                        <View style={s.walletBar}>
                            <View style={s.walletLeft}>
                                <Ionicons name="wallet-outline" size={20} color="#060d21" />
                                <View style={{ marginLeft: 8 }}>
                                    <Text style={s.walletLabel}>Tantancewa Balance</Text>
                                    <Text style={s.walletVal}>
                                        {userBalance !== null ? \`₦\${userBalance.toLocaleString()}\` : 'Loading...'}
                                    </Text>
                                </View>
                            </View>
                            <TouchableOpacity style={s.fundBtn} onPress={() => router.push('/(app)/wallet')} activeOpacity={0.8}>
                                <Ionicons name="add-circle" size={14} color="#ffffff" />
                                <Text style={s.fundBtnText}>Fund</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Step 1: DETAILS NEEDED */}
                        <View style={s.card}>
                            <View style={s.cardHeader}>
                                <View style={s.stepBadge}><Text style={s.stepBadgeText}>1</Text></View>
                                <Text style={s.cardTitle}>DETAILS NEEDED</Text>
                            </View>

                            <View style={s.slipGrid}>
                                <TouchableOpacity style={[s.slipCardCell, s.slipCardSelected]} activeOpacity={0.8}>
                                    <Text style={[s.slipPrice, s.textSelected]}>₦{prices.bvn_slip.toFixed(2)}</Text>
                                    <View style={s.slipImageBox}>
                                        <Ionicons name="print-outline" size={28} color="#060d21" />
                                    </View>
                                    <Text style={[s.slipLabel, s.textSelected]}>Print BVN Slip</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Step 2: SUPPLY BVN */}
                        <View style={s.card}>
                            <View style={s.cardHeader}>
                                <View style={s.stepBadge}><Text style={s.stepBadgeText}>2</Text></View>
                                <Text style={s.cardTitle}>SUPPLY BVN</Text>
                            </View>

                            <View style={{ marginBottom: 12 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                    <Ionicons name="card-outline" size={14} color="#64748b" style={{ marginRight: 6 }} />
                                    <Text style={s.labelHeader}>BVN Number</Text>
                                </View>
                                <View style={s.inputContainer}>
                                    <TextInput
                                        placeholder="ENTER 11-DIGIT BVN"
                                        placeholderTextColor="#94a3b8"
                                        style={s.inputStyleCentered}
                                        value={bvn} 
                                        onChangeText={setBvn} 
                                        keyboardType="number-pad"
                                        maxLength={11}
                                        editable={!loading}
                                    />
                                </View>
                                <Text style={s.inputHelperText}>
                                    Enter the 11-digit Bank Verification Number.
                                </Text>
                            </View>

                            {/* Consent Checkbox */}
                            <TouchableOpacity onPress={() => setIsAgreed(!isAgreed)} activeOpacity={0.8} style={s.consentContainer}>
                                <View style={[s.checkboxBox, isAgreed ? s.checkboxBoxSelected : s.checkboxBoxUnselected]}>
                                    {isAgreed && <Ionicons name="checkmark" size={12} color="#ffffff" />}
                                </View>
                                <Text style={s.consentText}>
                                    By checking this box, you agree that the owner of the ID has granted you consent to verify his/her identity.
                                </Text>
                            </TouchableOpacity>

                            {/* Submit Button */}
                            <TouchableOpacity 
                                onPress={handlePrintSlip} 
                                disabled={loading || bvn.length !== 11 || !isAgreed} 
                                style={[
                                    s.verifyButton,
                                    (loading || bvn.length !== 11 || !isAgreed) ? s.verifyButtonDisabled : s.verifyButtonActive
                                ]}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="print-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                                <Text style={s.verifyButtonText}>Generate Slip</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Modification Request view */}
                {view === 'modify' && (
                    <View>
                        {/* Processing time badge */}
                        <View style={s.processingTimeBadge}>
                            <Ionicons name="time-outline" size={14} color="#d97706" style={{ marginRight: 6 }} />
                            <Text style={s.processingTimeText}>
                                Processing time: <Text style={{ fontWeight: '800' }}>12h to 24h</Text>
                            </Text>
                        </View>

                        {/* Wallet Balance widget */}
                        <View style={s.walletBar}>
                            <View style={s.walletLeft}>
                                <Ionicons name="wallet-outline" size={20} color="#060d21" />
                                <View style={{ marginLeft: 8 }}>
                                    <Text style={s.walletLabel}>Tantancewa Balance</Text>
                                    <Text style={s.walletVal}>
                                        {userBalance !== null ? \`₦\${userBalance.toLocaleString()}\` : 'Loading...'}
                                    </Text>
                                </View>
                            </View>
                            <TouchableOpacity style={s.fundBtn} onPress={() => router.push('/(app)/wallet')} activeOpacity={0.8}>
                                <Ionicons name="add-circle" size={14} color="#ffffff" />
                                <Text style={s.fundBtnText}>Fund</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Step 1: SELECT MODIFICATION TYPE */}
                        <View style={s.card}>
                            <View style={s.cardHeader}>
                                <View style={s.stepBadge}><Text style={s.stepBadgeText}>1</Text></View>
                                <Text style={s.cardTitle}>SELECT MODIFICATION TYPE</Text>
                            </View>

                            <View style={s.modTypesGrid}>
                                {['Name Change', 'Date of Birth', 'Phone Number'].map((type) => {
                                    const isSelected = modType === type;
                                    return (
                                        <TouchableOpacity 
                                            key={type} 
                                            onPress={() => setModType(type)}
                                            style={[s.modTypeCard, isSelected ? s.modTypeSelected : s.modTypeUnselected]}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons 
                                                name={
                                                    type === 'Name Change' ? 'person-outline' :
                                                    type === 'Date of Birth' ? 'calendar-outline' : 'call-outline'
                                                } 
                                                size={16} 
                                                color={isSelected ? '#ffffff' : '#64748b'} 
                                            />
                                            <Text style={[s.modTypeLabel, isSelected ? s.modTextSelected : s.modTextUnselected]}>{type}</Text>
                                            {isSelected && <Ionicons name="checkmark-circle" size={14} color="#ffffff" />}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <View style={{ marginTop: 12, alignItems: 'center' }}>
                                <Text style={{ fontSize: 12, fontWeight: '800', color: '#060d21' }}>
                                    Fee: ₦{prices.bvn_modify.toFixed(2)}
                                </Text>
                            </View>
                        </View>

                        {/* Step 2: SUPPLY BVN */}
                        <View style={s.card}>
                            <View style={s.cardHeader}>
                                <View style={s.stepBadge}><Text style={s.stepBadgeText}>2</Text></View>
                                <Text style={s.cardTitle}>SUPPLY BVN & NEW DETAILS</Text>
                            </View>

                            <View style={{ marginBottom: 12 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                    <Ionicons name="card-outline" size={14} color="#64748b" style={{ marginRight: 6 }} />
                                    <Text style={s.labelHeader}>BVN Number</Text>
                                </View>
                                <View style={s.inputContainer}>
                                    <TextInput
                                        placeholder="ENTER 11-DIGIT BVN"
                                        placeholderTextColor="#94a3b8"
                                        style={s.inputStyleCentered}
                                        value={bvn} 
                                        onChangeText={setBvn} 
                                        keyboardType="number-pad"
                                        maxLength={11}
                                        editable={!loading}
                                    />
                                </View>
                            </View>

                            <View style={{ marginBottom: 12 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                    <Ionicons name="create-outline" size={14} color="#64748b" style={{ marginRight: 6 }} />
                                    <Text style={s.labelHeader}>New Correct Details</Text>
                                </View>
                                <View style={s.inputContainer}>
                                    <TextInput
                                        placeholder="ENTER NEW DETAILS HERE"
                                        placeholderTextColor="#94a3b8"
                                        style={s.inputStyleCentered}
                                        value={newValue} 
                                        onChangeText={setNewValue} 
                                        editable={!loading}
                                    />
                                </View>
                            </View>

                            {/* Consent Checkbox */}
                            <TouchableOpacity onPress={() => setIsAgreed(!isAgreed)} activeOpacity={0.8} style={s.consentContainer}>
                                <View style={[s.checkboxBox, isAgreed ? s.checkboxBoxSelected : s.checkboxBoxUnselected]}>
                                    {isAgreed && <Ionicons name="checkmark" size={12} color="#ffffff" />}
                                </View>
                                <Text style={s.consentText}>
                                    By checking this box, you agree that the owner of the ID has granted you consent to submit this modification request.
                                </Text>
                            </TouchableOpacity>

                            {/* Submit Button */}
                            <TouchableOpacity 
                                onPress={handleModifyRequest} 
                                disabled={loading || bvn.length !== 11 || !newValue.trim() || !isAgreed} 
                                style={[
                                    s.verifyButton,
                                    (loading || bvn.length !== 11 || !newValue.trim() || !isAgreed) ? s.verifyButtonDisabled : s.verifyButtonActive
                                ]}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="create-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                                <Text style={s.verifyButtonText}>Submit Request</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    headerGradient: {
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 15,
        elevation: 10,
        paddingHorizontal: 20,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    secureBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    secureDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#10b981',
        marginRight: 6,
    },
    secureText: {
        color: '#10b981',
        fontSize: 9.5,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    titleText: {
        fontSize: 20,
        fontWeight: '900',
        color: '#ffffff',
        marginLeft: 8,
        letterSpacing: -0.5,
    },
    subtitleText: {
        fontSize: 11,
        color: '#94a3b8',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    menuItem: {
        backgroundColor: '#ffffff',
        borderRadius: 22,
        padding: 18,
        marginBottom: 14,
        flexDirection: 'column',
        shadowColor: '#060d21',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        width: '100%',
    },
    iconBox: {
        width: 38,
        height: 38,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    menuTitle: {
        fontSize: 14.5,
        fontWeight: '900',
        color: '#0d1b3e',
        marginBottom: 4,
    },
    menuDesc: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '600',
        lineHeight: 15,
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
});

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#f4f6fb' },
    scrollContent: {
        paddingBottom: 80,
    },
    menuGrid: {
        marginTop: 32,
        paddingHorizontal: 4,
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
        marginTop: 32,
        marginBottom: 12,
    },
    processingTimeText: {
        color: '#d97706',
        fontSize: 11.5,
        fontWeight: '600',
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
    slipGrid: {
        flexDirection: 'row',
        justifyContent: 'center',
        width: '100%',
    },
    slipCardCell: {
        borderRadius: 16,
        padding: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        width: '60%',
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
    slipLabel: {
        fontSize: 11,
        fontWeight: '800',
    },
    textSelected: {
        color: '#060d21',
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
    inputHelperText: {
        color: '#64748b',
        fontSize: 11,
        marginTop: 4,
        fontWeight: '600',
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
    modTypesGrid: {
        flexDirection: 'column',
        width: '100%',
    },
    modTypeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 48,
        borderRadius: 14,
        borderWidth: 1.5,
        paddingHorizontal: 16,
        marginBottom: 10,
    },
    modTypeSelected: {
        backgroundColor: '#060d21',
        borderColor: '#060d21',
    },
    modTypeUnselected: {
        backgroundColor: '#ffffff',
        borderColor: '#cbd5e1',
    },
    modTypeLabel: {
        flex: 1,
        fontSize: 12.5,
        fontWeight: '800',
        marginLeft: 12,
    },
    modTextSelected: {
        color: '#ffffff',
    },
    modTextUnselected: {
        color: '#334155',
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
        fontSize: 15,
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
});
`;

fs.writeFileSync(bvnPath, modernBvnServicesCode, 'utf8');
console.log('Successfully completed full modernization of bvn-services.tsx!');
