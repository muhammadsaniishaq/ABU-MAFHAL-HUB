import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform, LayoutAnimation, Modal, FlatList, StyleSheet, Linking } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { api } from '../services/api';
import { supabase } from '../services/supabase';
import { DataPlan } from '../services/partners';
import SecurityModal from '../components/SecurityModal';
import TransactionConfirmationModal from '../components/TransactionConfirmationModal';

const parseVolumeToGB = (volume: any, name: string): number => {
    const text = (String(volume || '') + ' ' + String(name || '')).toLowerCase();
    
    // Check for GB first
    const gbMatch = text.match(/(\d+(\.\d+)?)\s*(gb|gig|g)/i);
    if (gbMatch) {
        return parseFloat(gbMatch[1]);
    }
    
    // Check for MB
    const mbMatch = text.match(/(\d+)\s*(mb|meg|m)/i);
    if (mbMatch) {
        return parseFloat(mbMatch[1]) / 1024;
    }
    
    // Default fallback if we can't parse it
    return 0;
};

// Network Logos
const NETWORK_LOGOS: Record<string, any> = {
    mtn: require('../assets/images/mtn.png'),
    glo: require('../assets/images/glo.png'),
    airtel: require('../assets/images/airtel.png'),
    '9mobile': require('../assets/images/9mobile.png'),
};

const NETWORKS_DATA = [
    { id: 'mtn', name: 'MTN', color: '#FFCC00', prefixes: ['0803', '0806', '0703', '0903', '0810', '0813', '0814', '0816', '0906', '0706', '0913', '0916'] },
    { id: 'glo', name: 'Glo', color: '#0F6A37', prefixes: ['0805', '0807', '0705', '0815', '0811', '0905', '0915'] },
    { id: 'airtel', name: 'Airtel', color: '#FF0000', prefixes: ['0802', '0808', '0708', '0812', '0701', '0902', '0904', '0907', '0901', '0912'] },
    { id: '9mobile', name: '9mobile', color: '#006B3E', prefixes: ['0809', '0818', '0817', '0909', '0908'] },
];

const getNetworkStyles = (netId: string, isSelected: boolean) => {
    if (!isSelected) {
        return { bg: '#ffffff', border: '#e2e8f0', text: '#64748b' };
    }
    switch (netId) {
        case 'mtn':
            return { bg: '#fffbeb', border: '#eab308', text: '#854d0e' };
        case 'airtel':
            return { bg: '#fef2f2', border: '#ef4444', text: '#991b1b' };
        case 'glo':
            return { bg: '#f0fdf4', border: '#16a34a', text: '#166534' };
        case '9mobile':
            return { bg: '#ecfdf5', border: '#059669', text: '#065f46' };
        default:
            return { bg: '#f1f5f9', border: '#475569', text: '#1e293b' };
    }
};

const T = {
  navy:    '#0d1b3e',
  navyMid: '#142258',
  gold:    '#f5a623',
  goldDk:  '#d4890e',
  white:   '#ffffff',
  bg:      '#f4f6fb',
  text:    '#0d1b3e',
  textSub: '#5a6890',
  indigo:  '#4F46E5',
};

export default function DataScreen() {
    const [network, setNetwork] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [selectedPlan, setSelectedPlan] = useState<DataPlan | null>(null);
    const [plans, setPlans] = useState<DataPlan[]>([]);
    const [loadingPlans, setLoadingPlans] = useState(false);
    const [loadingPurchase, setLoadingPurchase] = useState(false);
    
    // UI states
    const [balance, setBalance] = useState<number | null>(null);
    const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
    const [showBeneficiaryModal, setShowBeneficiaryModal] = useState(false);
    const [showSecurityModal, setShowSecurityModal] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [planFilter, setPlanFilter] = useState<'All' | 'Favorites' | 'Daily' | 'Weekly' | 'Monthly'>('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [lastTransaction, setLastTransaction] = useState<any>(null);
    const [favorites, setFavorites] = useState<string[]>([]);
    const [beneficiarySearch, setBeneficiarySearch] = useState('');
    
    // Premium features states
    const [autoRenew, setAutoRenew] = useState(false);
    const [isGift, setIsGift] = useState(false);
    const [recipientName, setRecipientName] = useState('');
    const [showEstimator, setShowEstimator] = useState(false);
    const [socialHours, setSocialHours] = useState(0);
    const [streamingHours, setStreamingHours] = useState(0);
    const [browsingHours, setBrowsingHours] = useState(0);
    const [minVolumeFilter, setMinVolumeFilter] = useState<number | null>(null);
    const [showUssdGuide, setShowUssdGuide] = useState(false);
    
    const router = useRouter();
    const isWeb = Platform.OS === 'web';

    // Initial Data Load
    useEffect(() => {
        fetchUserData();
        fetchBeneficiaries();
        fetchLastTransaction();
        loadFavorites();
    }, []);

    const loadFavorites = async () => {
        try {
            const saved = await AsyncStorage.getItem('data_favorites');
            if (saved) {
                setFavorites(JSON.parse(saved));
            }
        } catch (e) {
            console.error("Failed to load favorites", e);
        }
    };

    const fetchLastTransaction = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        const { data } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', user.id)
            .eq('type', 'data')
            .eq('status', 'success')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
            
        if (data) setLastTransaction(data);
    };

    const fetchUserData = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase.from('profiles').select('balance').eq('id', user.id).single();
            if (data) setBalance(data.balance);
        }
    };

    const fetchBeneficiaries = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase.from('beneficiaries').select('*').eq('user_id', user.id);
            if (data) setBeneficiaries(data);
        }
    };

    // Auto-detect Network
    const detectNetwork = useCallback((phone: string) => {
        const cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length >= 4) {
            const prefix = cleanPhone.substring(0, 4);
            const found = NETWORKS_DATA.find(n => n.prefixes.includes(prefix));
            if (found && found.id !== network) {
                 setNetwork(found.id);
            }
        }
    }, [network]);

    const handlePhoneChange = (text: string) => {
        setPhoneNumber(text);
        detectNetwork(text);
    };

    // Fetch plans when network changes
    useEffect(() => {
        if (network) {
            fetchPlans(network);
            setSelectedPlan(null); // Reset selection
        } else {
            setPlans([]);
        }
    }, [network]);

    // Derived State: Filtered Plans
    const filteredPlans = plans.filter(p => {
        // Search Filter
        if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) {
            return false;
        }

        // Min Volume Filter (from Data Usage Estimator)
        if (minVolumeFilter !== null) {
            const gb = parseVolumeToGB(p.volume, p.originalName || p.name);
            if (gb < minVolumeFilter) {
                return false;
            }
        }

        // Duration Filter
        if (planFilter === 'All') return true;
        if (planFilter === 'Favorites') return favorites.includes(p.id);
        
        const rawVal = (p.validity || '').toLowerCase();
        const nameVal = (p.originalName || p.name).toLowerCase();
        let days = parseInt(p.validity) || 0;

        const combinedText = rawVal + ' ' + nameVal;
        const durationMatch = combinedText.match(/(\d+)\s*(day|week|month|hr|hour)/i);
        
        if (durationMatch) {
            const num = parseInt(durationMatch[1]);
            const unit = durationMatch[2].toLowerCase();
            
            if (unit.startsWith('hr') || unit.startsWith('hour')) days = 1;
            else if (unit.startsWith('day')) days = num;
            else if (unit.startsWith('week')) days = num * 7;
            else if (unit.startsWith('month')) days = num * 30;
        }

        if (days === 0 || days === 30) {
            if (combinedText.includes('daily') || combinedText.includes('24hr')) days = 1;
            else if (combinedText.includes('weekly')) days = 7;
            else if (combinedText.includes('monthly') || combinedText.includes('30 days')) days = 30;
        }

        if (planFilter === 'Daily') {
             return (days > 0 && days < 7);
        }
        if (planFilter === 'Weekly') {
             return (days >= 7 && days < 28);
        }
        if (planFilter === 'Monthly') {
             return (days >= 28);
        }
        return true;
    });

    const handleQuickRepeat = () => {
        if (!lastTransaction) return;
        
        const desc = lastTransaction.description || '';
        const parts = desc.split(' -> ');
        if (parts.length === 2) {
             const phone = parts[1];
             setPhoneNumber(phone);
             detectNetwork(phone);
             Alert.alert("Quick Load", `Phone number ${phone} loaded. Please select your plan.`);
        }
    };

    const toggleFavorite = async (planId: string) => {
        try {
            const updated = favorites.includes(planId) ? favorites.filter(id => id !== planId) : [...favorites, planId];
            setFavorites(updated);
            await AsyncStorage.setItem('data_favorites', JSON.stringify(updated));
        } catch (e) {
            console.error("Failed to save favorites", e);
        }
    };

    const fetchPlans = async (netId: string) => {
        setLoadingPlans(true);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        try {
            const { data, error } = await supabase
                .from('data_plans')
                .select('*')
                .eq('network', netId.toLowerCase())
                .eq('is_active', true)
                .order('cost_price', { ascending: true });

            if (error) throw error;

            const mappedPlans: DataPlan[] = (data || []).map((p: any) => {
                let inferredValidity = p.validity;
                if (!inferredValidity) {
                    const nameLower = p.name.toLowerCase();
                    if (nameLower.includes('daily') || nameLower.includes('24hr')) inferredValidity = '1 Day';
                    else if (nameLower.includes('weekly') || nameLower.includes('7 days')) inferredValidity = '7 Days';
                    else if (nameLower.includes('monthly') || nameLower.includes('30 days')) inferredValidity = '30 Days';
                    else {
                         const match = p.name.match(/(\d+)\s*(day|week|month|hr)/i);
                         if (match) inferredValidity = match[0];
                         else inferredValidity = '30 Days';
                    }
                }

                return {
                    id: p.plan_id,
                    code: p.plan_id,
                    name: p.name.replace(/\b(Daily|Weekly|Monthly|Day|Week|Month|Days|Weeks|Months|Hour|Hours|Hr|Hrs)\b/gi, '').replace(/\d+(hr|hrs)/gi, '').trim(),
                    originalName: p.name,
                    price: p.selling_price,
                    validity: inferredValidity,
                    volume: p.volume,
                    network: p.network,
                    icon: p.icon_url
                };
            });

            setPlans(mappedPlans);
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to load data plans");
        } finally {
            setLoadingPlans(false);
        }
    };

    const handlePurchase = () => {
        if (!network || !phoneNumber || !selectedPlan) {
            Alert.alert("Error", "Please fill all fields");
            return;
        }

        if (phoneNumber.length < 11) {
             Alert.alert("Invalid Phone", "Please enter a valid 11-digit phone number");
             return;
        }

        setShowConfirmation(true);
    };

    const processTransaction = async () => {
        if (!selectedPlan) return;
        setLoadingPurchase(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not authenticated");

            const planNameString = selectedPlan.name + 
                (autoRenew ? ' [Auto-Renew]' : '') + 
                (isGift ? ` (Gift to ${recipientName || 'Someone'})` : '');

            const result = await api.data.purchase(user.id, {
                network,
                phone: phoneNumber,
                planId: selectedPlan.id,
                amount: selectedPlan.price,
                planName: planNameString
            });

            if (result.success) {
                router.replace({
                    pathname: '/success',
                    params: {
                        amount: `₦${selectedPlan.price}`,
                        type: 'Data Bundle',
                        reference: result.reference
                    }
                });
            }
        } catch (error: any) {
            console.error(error);
            Alert.alert("Error", error.message || "Something went wrong");
        } finally {
            setLoadingPurchase(false);
        }
    };

    const getNetworkColor = (netId: string) => {
        return NETWORKS_DATA.find(n => n.id === netId)?.color || '#0056D2';
    };

    return (
        <View style={s.pageWrapper}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            <KeyboardAvoidingView 
                behavior={Platform.OS === "ios" ? "padding" : "height"} 
                style={{ flex: 1 }}
            >
                {/* Premium Curved Header */}
                <LinearGradient 
                    colors={['#060d21', '#0d1b3e']} 
                    style={[s.headerContainer, isWeb && s.webPageContainer]}
                >
                    <View style={s.headerTop}>
                        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
                            <Ionicons name="arrow-back" size={20} color="white" />
                        </TouchableOpacity>
                        <View style={{ alignItems: 'center' }}>
                            <Text style={s.headerTitle}>Internet Data</Text>
                            {balance !== null && (
                                <View style={s.balanceBadge}>
                                    <Ionicons name="wallet-outline" size={12} color="#f5a623" style={{ marginRight: 4 }} />
                                    <Text style={s.headerBalance}>
                                        ₦{balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <View style={{ width: 32 }} />
                    </View>
                </LinearGradient>

                <ScrollView 
                    style={{ flex: 1 }}
                    contentContainerStyle={[s.scrollContainer, isWeb && s.webPageContainer]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Quick Repeat Card */}
                    {lastTransaction && (
                        <TouchableOpacity 
                            onPress={handleQuickRepeat}
                            style={s.quickRepeatCard}
                            activeOpacity={0.8}
                        >
                            <View style={s.quickRepeatLeft}>
                                <View style={s.quickRepeatIconCircle}>
                                    <Ionicons name="refresh" size={18} color="#F97316" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.quickRepeatTitle}>Repeat Last Purchase</Text>
                                    <Text style={s.quickRepeatDesc} numberOfLines={1} ellipsizeMode="tail">
                                        {lastTransaction.description ? lastTransaction.description.split('->')[0].trim() : 'Data Bundle'}
                                    </Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
                        </TouchableOpacity>
                    )}

                    {/* Network Selection */}
                    <View style={s.sectionHeader}>
                        <Ionicons name="cellular-outline" size={14} color="#0d1b3e" style={{ marginRight: 6 }} />
                        <Text style={s.sectionTitle}>Select Network</Text>
                    </View>
                    <View style={s.networksRow}>
                        {NETWORKS_DATA.map((net) => {
                            const isSelected = network === net.id;
                            const styles = getNetworkStyles(net.id, isSelected);
                            return (
                                <TouchableOpacity
                                    key={net.id}
                                    onPress={() => setNetwork(net.id)}
                                    style={[
                                        s.networkCard,
                                        { backgroundColor: styles.bg, borderColor: styles.border },
                                        isSelected && s.networkCardSelected
                                    ]}
                                    activeOpacity={0.8}
                                >
                                    <View style={s.networkLogoWrapper}>
                                        <Image 
                                            source={NETWORK_LOGOS[net.id]} 
                                            style={s.networkLogo as any}
                                            resizeMode="contain" 
                                        />
                                    </View>
                                    <Text style={[s.networkName, isSelected && { color: styles.text, fontWeight: '800' }]}>
                                        {net.name}
                                    </Text>
                                    {isSelected && (
                                        <View style={[s.checkBadge, { backgroundColor: styles.border }]}>
                                            <Ionicons name="checkmark" size={8} color="white" />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Phone Number Input */}
                    <View style={s.sectionHeader}>
                        <Ionicons name="phone-portrait-outline" size={14} color="#0d1b3e" style={{ marginRight: 6 }} />
                        <Text style={s.sectionTitle}>Phone Number</Text>
                    </View>
                    <View style={[s.inputBoxContainer, phoneNumber.length > 0 && s.inputBoxFocused]}>
                        <View style={s.inputBoxLogoWrapper}>
                            {network ? (
                                <Image source={NETWORK_LOGOS[network]} style={s.inputBoxLogo as any} resizeMode="cover" />
                            ) : (
                                <Ionicons name="call-outline" size={18} color="#94a3b8" />
                            )}
                        </View>
                        <TextInput
                            style={s.textInput}
                            keyboardType="phone-pad"
                            placeholder="Enter 11-digit phone number"
                            placeholderTextColor="#94a3b8"
                            value={phoneNumber}
                            onChangeText={handlePhoneChange}
                            maxLength={11}
                        />
                        <TouchableOpacity 
                            onPress={() => setShowBeneficiaryModal(true)}
                            style={s.beneficiaryBtn}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="people" size={18} color="#0056D2" />
                        </TouchableOpacity>

                        {phoneNumber.length > 0 && (
                            <TouchableOpacity onPress={() => handlePhoneChange('')} style={s.clearBtn}>
                                <Ionicons name="close-circle" size={18} color="#D1D5DB" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* USSD Check Codes Collapsible Card */}
                    <View style={s.ussdContainer}>
                        <TouchableOpacity 
                            onPress={() => {
                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                setShowUssdGuide(!showUssdGuide);
                            }}
                            style={s.ussdHeader}
                            activeOpacity={0.8}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="help-circle-outline" size={16} color="#d97706" style={{ marginRight: 6 }} />
                                <Text style={s.ussdHeaderTitle}>USSD Balance Check Codes</Text>
                            </View>
                            <Ionicons 
                                name={showUssdGuide ? "chevron-up" : "chevron-down"} 
                                size={16} 
                                color="#64748b" 
                            />
                        </TouchableOpacity>

                        {showUssdGuide && (
                            <View style={s.ussdContent}>
                                {[
                                    { net: 'MTN', code: '*323#', legacy: '*312*4#' },
                                    { net: 'Airtel', code: '*323#', legacy: '*140#' },
                                    { net: 'Glo', code: '*323#', legacy: '*127*0#' },
                                    { net: '9mobile', code: '*323#', legacy: '*228#' }
                                ].map((item, index) => (
                                    <View key={index} style={s.ussdRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={s.ussdNetName}>{item.net}</Text>
                                            <Text style={s.ussdSubText}>Unified: {item.code} | Legacy: {item.legacy}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', gap: 6 }}>
                                            <TouchableOpacity 
                                                style={s.ussdActionBtn} 
                                                onPress={async () => {
                                                    await Clipboard.setStringAsync(item.code);
                                                    Alert.alert("Copied", `${item.code} copied to clipboard!`);
                                                }}
                                            >
                                                <Ionicons name="copy-outline" size={13} color="#0d1b3e" />
                                                <Text style={s.ussdActionText}>Copy</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity 
                                                style={[s.ussdActionBtn, { backgroundColor: '#eff6ff' }]} 
                                                onPress={() => Linking.openURL(`tel:${encodeURIComponent(item.code)}`)}
                                            >
                                                <Ionicons name="call-outline" size={13} color="#2563eb" />
                                                <Text style={[s.ussdActionText, { color: '#2563eb' }]}>Dial</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>

                    {/* Data Usage Estimator Collapsible Card */}
                    <View style={s.estimatorContainer}>
                        <TouchableOpacity 
                            onPress={() => {
                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                setShowEstimator(!showEstimator);
                            }}
                            style={s.estimatorHeader}
                            activeOpacity={0.8}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="calculator-outline" size={16} color="#2563eb" style={{ marginRight: 6 }} />
                                <Text style={s.estimatorHeaderTitle}>Data Usage Estimator & Recommendations</Text>
                            </View>
                            <Ionicons 
                                name={showEstimator ? "chevron-up" : "chevron-down"} 
                                size={16} 
                                color="#64748b" 
                            />
                        </TouchableOpacity>

                        {showEstimator && (
                            <View style={s.estimatorContent}>
                                <Text style={s.estimatorIntro}>
                                    Adjust your daily usage estimation below to find the best data bundle.
                                </Text>

                                {/* Social Slider Row */}
                                <View style={s.estimatorRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.estimatorLabel}>Social & Chatting</Text>
                                        <Text style={s.estimatorSubLabel}>WhatsApp, IG, TikTok, FB (~150MB/hr)</Text>
                                    </View>
                                    <View style={s.counterGroup}>
                                        <TouchableOpacity 
                                            style={s.counterBtn}
                                            onPress={() => setSocialHours(h => Math.max(0, h - 1))}
                                        >
                                            <Ionicons name="remove" size={14} color="#0d1b3e" />
                                        </TouchableOpacity>
                                        <Text style={s.counterValue}>{socialHours}h</Text>
                                        <TouchableOpacity 
                                            style={s.counterBtn}
                                            onPress={() => setSocialHours(h => Math.min(24, h + 1))}
                                        >
                                            <Ionicons name="add" size={14} color="#0d1b3e" />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Video Streaming Row */}
                                <View style={s.estimatorRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.estimatorLabel}>Video Streaming</Text>
                                        <Text style={s.estimatorSubLabel}>YouTube, Netflix, HD Video (~600MB/hr)</Text>
                                    </View>
                                    <View style={s.counterGroup}>
                                        <TouchableOpacity 
                                            style={s.counterBtn}
                                            onPress={() => setStreamingHours(h => Math.max(0, h - 1))}
                                        >
                                            <Ionicons name="remove" size={14} color="#0d1b3e" />
                                        </TouchableOpacity>
                                        <Text style={s.counterValue}>{streamingHours}h</Text>
                                        <TouchableOpacity 
                                            style={s.counterBtn}
                                            onPress={() => setStreamingHours(h => Math.min(24, h + 1))}
                                        >
                                            <Ionicons name="add" size={14} color="#0d1b3e" />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Web Browsing Row */}
                                <View style={s.estimatorRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.estimatorLabel}>Web & Emails</Text>
                                        <Text style={s.estimatorSubLabel}>Browsing, reading, downloading (~80MB/hr)</Text>
                                    </View>
                                    <View style={s.counterGroup}>
                                        <TouchableOpacity 
                                            style={s.counterBtn}
                                            onPress={() => setBrowsingHours(h => Math.max(0, h - 1))}
                                        >
                                            <Ionicons name="remove" size={14} color="#0d1b3e" />
                                        </TouchableOpacity>
                                        <Text style={s.counterValue}>{browsingHours}h</Text>
                                        <TouchableOpacity 
                                            style={s.counterBtn}
                                            onPress={() => setBrowsingHours(h => Math.min(24, h + 1))}
                                        >
                                            <Ionicons name="add" size={14} color="#0d1b3e" />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Calculation Results */}
                                {(() => {
                                    const hourlyGB = (socialHours * 0.15) + (streamingHours * 0.60) + (browsingHours * 0.08);
                                    const weeklyGB = Math.round(hourlyGB * 7 * 10) / 10;
                                    const monthlyGB = Math.round(hourlyGB * 30 * 10) / 10;

                                    return (
                                        <View style={s.estimatorResultsCard}>
                                            <View style={s.resultBox}>
                                                <Text style={s.resultVal}>{weeklyGB} GB</Text>
                                                <Text style={s.resultLbl}>Weekly Est.</Text>
                                            </View>
                                            <View style={[s.resultBox, { borderLeftWidth: 1, borderLeftColor: '#e2e8f0' }]}>
                                                <Text style={[s.resultVal, { color: '#2563eb' }]}>{monthlyGB} GB</Text>
                                                <Text style={s.resultLbl}>Monthly Est.</Text>
                                            </View>
                                            
                                            {monthlyGB > 0 && (
                                                <TouchableOpacity 
                                                    style={s.recommendBtn}
                                                    onPress={() => {
                                                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                                        setMinVolumeFilter(monthlyGB);
                                                        setShowEstimator(false); // Collapse
                                                    }}
                                                >
                                                    <Ionicons name="sparkles" size={12} color="white" style={{ marginRight: 4 }} />
                                                    <Text style={s.recommendBtnText}>Recommend</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    );
                                })()}
                            </View>
                        )}
                    </View>

                    {/* Recommendation Banner */}
                    {minVolumeFilter !== null && (
                        <View style={s.recommendationBanner}>
                            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="sparkles" size={16} color="#d97706" style={{ marginRight: 6 }} />
                                <Text style={s.recommendationBannerText}>
                                    Showing plans with at least <Text style={{ fontWeight: '800' }}>{minVolumeFilter} GB</Text>
                                </Text>
                            </View>
                            <TouchableOpacity 
                                onPress={() => {
                                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                    setMinVolumeFilter(null);
                                }}
                                style={s.recommendationBannerClose}
                            >
                                <Text style={s.recommendationBannerCloseText}>Clear</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Data Plans Grid */}
                    {loadingPlans ? (
                        <View style={{ height: 160, alignItems: 'center', justifyContent: 'center' }}>
                            <ActivityIndicator size="large" color="#0d1b3e" />
                            <Text style={{ color: '#94a3b8', marginTop: 8, fontSize: 13 }}>Loading plans...</Text>
                        </View>
                    ) : (
                        <View>
                            {plans.length > 0 && (
                                <View style={{ marginBottom: 20 }}>
                                    {/* Search Bar */}
                                    <View style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        backgroundColor: '#ffffff',
                                        borderRadius: 14,
                                        paddingHorizontal: 12,
                                        height: 44,
                                        marginBottom: 16,
                                        borderWidth: 1.5,
                                        borderColor: '#e2e8f0',
                                    }}>
                                        <Ionicons name="search-outline" size={18} color="#94a3b8" />
                                        <TextInput 
                                            style={{ flex: 1, marginLeft: 8, fontSize: 14, color: '#0d1b3e', fontWeight: '500' }}
                                            placeholder="Search plans (e.g. 1GB, Weekend)..."
                                            placeholderTextColor="#94a3b8"
                                            value={searchQuery}
                                            onChangeText={text => {
                                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                                setSearchQuery(text);
                                            }}
                                        />
                                        {searchQuery.length > 0 && (
                                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                                <Ionicons name="close-circle" size={16} color="#D1D5DB" />
                                            </TouchableOpacity>
                                        )}
                                    </View>

                                    <View style={s.sectionHeader}>
                                        <Ionicons name="funnel-outline" size={14} color="#0d1b3e" style={{ marginRight: 6 }} />
                                        <Text style={s.sectionTitle}>Filter Plans</Text>
                                    </View>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 8 }}>
                                        {[
                                            { name: 'All', icon: 'grid-outline' },
                                            { name: 'Favorites', icon: 'heart' },
                                            { name: 'Daily', icon: 'today-outline' },
                                            { name: 'Weekly', icon: 'calendar-outline' },
                                            { name: 'Monthly', icon: 'time-outline' },
                                        ].map((f) => {
                                            const isActive = planFilter === f.name;
                                            return (
                                                <TouchableOpacity
                                                    key={f.name}
                                                    onPress={() => setPlanFilter(f.name as any)}
                                                    style={[s.filterPill, isActive && s.filterPillActive]}
                                                    activeOpacity={0.8}
                                                >
                                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                        <Ionicons 
                                                            name={f.icon as any} 
                                                            size={13} 
                                                            color={isActive ? '#ffffff' : '#64748b'} 
                                                            style={{ marginRight: 5 }} 
                                                        />
                                                        <Text style={[s.filterPillText, isActive && s.filterPillTextActive]}>
                                                            {f.name}
                                                        </Text>
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </ScrollView>
                                </View>
                            )}
                            
                            {plans.length > 0 && (
                                <View style={s.sectionHeader}>
                                    <Ionicons name="flash-outline" size={14} color="#0d1b3e" style={{ marginRight: 6 }} />
                                    <Text style={s.sectionTitle}>Available Plans</Text>
                                </View>
                            )}
                            
                            {!network ? (
                                 <View style={{
                                     height: 120,
                                     alignItems: 'center',
                                     justifyContent: 'center',
                                     backgroundColor: '#eff6ff',
                                     borderRadius: 20,
                                     borderStyle: 'dashed',
                                     borderWidth: 1.5,
                                     borderColor: '#bfdbfe',
                                     paddingHorizontal: 20,
                                 }}>
                                     <Ionicons name="cellular-outline" size={28} color="#3b82f6" />
                                     <Text style={{ color: '#3b82f6', marginTop: 8, fontWeight: '700', fontSize: 13 }}>
                                         Select a network to see plans
                                     </Text>
                                 </View>
                            ) : (
                                <View style={s.plansContainer}>
                                    {filteredPlans.map((plan) => {
                                        const isSelected = selectedPlan?.id === plan.id;
                                        const isFav = favorites.includes(plan.id);
                                        const isBestValue = (plan.validity.toLowerCase().includes('30') && plan.price < 1000);
                                        const isMega = plan.name.toLowerCase().includes('mega');
                                        
                                        return (
                                        <View key={plan.id} style={s.planCardWrapper}>
                                            <TouchableOpacity
                                                onPress={() => setSelectedPlan(plan)}
                                                style={[s.planCard, isSelected && s.planCardSelected]}
                                                activeOpacity={0.7}
                                            >
                                                <LinearGradient
                                                    colors={isSelected ? ['#102258', '#0b163a'] : ['#ffffff', '#ffffff']}
                                                    style={s.planCardGradient}
                                                >
                                                    {isBestValue && (
                                                        <View style={s.bestValueBadge}>
                                                            <Text style={s.bestValueText}>BEST VALUE</Text>
                                                        </View>
                                                    )}
                                                    {isMega && (
                                                        <View style={[s.bestValueBadge, { backgroundColor: '#8b5cf6' }]}>
                                                            <Text style={s.bestValueText}>MEGA</Text>
                                                        </View>
                                                    )}

                                                    <View style={s.planValidityContainer}>
                                                        <View style={[s.validityBadge, isSelected && s.validityBadgeSelected]}>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                                <Ionicons 
                                                                    name="time-outline" 
                                                                    size={10} 
                                                                    color={isSelected ? '#ffffff' : '#64748b'} 
                                                                    style={{ marginRight: 3 }} 
                                                                />
                                                                <Text style={[s.validityText, isSelected && s.validityTextSelected]}>
                                                                    {plan.validity}
                                                                </Text>
                                                            </View>
                                                        </View>
                                                        
                                                        <TouchableOpacity onPress={() => toggleFavorite(plan.id)} style={{ padding: 4 }}>
                                                            <Ionicons 
                                                                name={isFav ? "heart" : "heart-outline"} 
                                                                size={18} 
                                                                color={isFav ? (isSelected ? "#f87171" : "#ef4444") : (isSelected ? "rgba(255,255,255,0.4)" : "#94a3b8")} 
                                                            />
                                                        </TouchableOpacity>
                                                    </View>
                                                    
                                                    <Text style={[s.planName, isSelected && s.planNameSelected]} numberOfLines={2}>
                                                        {plan.name}
                                                    </Text>
                                                    <Text style={[s.planPrice, isSelected && s.planPriceSelected]}>
                                                        ₦{plan.price.toLocaleString()}
                                                    </Text>
                                                </LinearGradient>
                                            </TouchableOpacity>
                                        </View>
                                    )})}
                                    
                                    {plans.length > 0 && filteredPlans.length === 0 && (
                                         <View style={{ width: '100%', alignItems: 'center', justifyContent: 'center', paddingVertical: 24 }}>
                                            <Text style={{ color: '#94a3b8', fontSize: 13 }}>No matching plans found.</Text>
                                         </View>
                                    )}
                                    
                                    {plans.length === 0 && (
                                         <View style={{ width: '100%', alignItems: 'center', justifyContent: 'center', paddingVertical: 24 }}>
                                            <Text style={{ color: '#94a3b8', fontSize: 13 }}>No active plans found for this network.</Text>
                                         </View>
                                    )}
                                </View>
                            )}
                        </View>
                    )}

                    {/* Auto-Renew and Gifting Options */}
                    {selectedPlan && (
                        <View style={s.optionsContainer}>
                            <View style={s.optionRow}>
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Ionicons name="repeat" size={16} color="#0d1b3e" style={{ marginRight: 6 }} />
                                        <Text style={s.optionTitle}>Auto-Renew Bundle</Text>
                                    </View>
                                    <Text style={s.optionDesc}>Automatically renews this data plan upon expiry</Text>
                                </View>
                                <TouchableOpacity 
                                    onPress={() => setAutoRenew(!autoRenew)}
                                    style={[s.customSwitch, autoRenew ? s.customSwitchOn : s.customSwitchOff]}
                                    activeOpacity={0.8}
                                >
                                    <View style={[s.customSwitchThumb, autoRenew ? s.customSwitchThumbOn : s.customSwitchThumbOff]} />
                                </TouchableOpacity>
                            </View>

                            <View style={[s.optionRow, { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 12, marginTop: 12 }]}>
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Ionicons name="gift-outline" size={16} color="#0d1b3e" style={{ marginRight: 6 }} />
                                        <Text style={s.optionTitle}>Send as a Gift</Text>
                                    </View>
                                    <Text style={s.optionDesc}>Mark this purchase as a gift for someone else</Text>
                                </View>
                                <TouchableOpacity 
                                    onPress={() => {
                                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                        setIsGift(!isGift);
                                        if (isGift) setRecipientName('');
                                    }}
                                    style={[s.customSwitch, isGift ? s.customSwitchOn : s.customSwitchOff]}
                                    activeOpacity={0.8}
                                >
                                    <View style={[s.customSwitchThumb, isGift ? s.customSwitchThumbOn : s.customSwitchThumbOff]} />
                                </TouchableOpacity>
                            </View>

                            {isGift && (
                                <View style={s.giftInputContainer}>
                                    <TextInput 
                                        style={s.giftInput}
                                        placeholder="Enter Recipient's Name (e.g. Sani Sadiq)"
                                        placeholderTextColor="#94a3b8"
                                        value={recipientName}
                                        onChangeText={setRecipientName}
                                    />
                                </View>
                            )}
                        </View>
                    )}
                </ScrollView>

                {/* Bottom Floating Button */}
                <View style={[s.bottomButtonWrapper, isWeb && s.webPageContainer]}>
                    <TouchableOpacity
                        style={[
                            s.purchaseBtn,
                            network && phoneNumber.length === 11 && selectedPlan && { shadowColor: '#d97706', shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
                            !(network && phoneNumber.length === 11 && selectedPlan && !loadingPurchase) && { backgroundColor: '#cbd5e1', shadowOpacity: 0 }
                        ]}
                        onPress={handlePurchase}
                        disabled={!network || phoneNumber.length !== 11 || !selectedPlan || loadingPurchase}
                    >
                        {loadingPurchase ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <LinearGradient
                                colors={network && phoneNumber.length === 11 && selectedPlan ? ['#eab308', '#d97706'] : ['#cbd5e1', '#cbd5e1']}
                                style={s.purchaseBtnGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                <Text style={s.purchaseBtnText}>
                                    {selectedPlan ? `Pay ₦${selectedPlan.price.toLocaleString()}` : 'Purchase Bundle'}
                                </Text>
                                <Ionicons name="arrow-forward" size={16} color="white" style={{ marginLeft: 6 }} />
                            </LinearGradient>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            <BeneficiaryModal />

            <TransactionConfirmationModal
                visible={showConfirmation}
                onClose={() => setShowConfirmation(false)}
                onConfirm={() => {
                    setShowConfirmation(false);
                    setTimeout(() => setShowSecurityModal(true), 500);
                }}
                title="Confirm Data Purchase"
                network={network}
                details={[
                    { label: 'Transaction Type', value: 'Data Bundle' },
                    { label: 'Network', value: NETWORKS_DATA.find(n => n.id === network)?.name || network },
                    { label: 'Phone Number', value: phoneNumber },
                    { label: 'Data Plan', value: selectedPlan?.name || '-' },
                    { label: 'Validity', value: selectedPlan?.validity || '-' },
                    ...(autoRenew ? [{ label: 'Auto-Renew', value: 'Enabled (Every ' + (selectedPlan?.validity || 'month') + ')' }] : []),
                    ...(isGift ? [{ label: 'Gifting To', value: recipientName || 'Anonymous' }] : []),
                    { label: 'Original Price', value: `₦${selectedPlan?.price?.toLocaleString() || '0'}`, isAmount: true },
                    { label: 'Total To Pay', value: `₦${selectedPlan?.price?.toLocaleString() || '0'}`, isTotal: true },
                ]}
            />

            <SecurityModal 
                visible={showSecurityModal}
                onClose={() => setShowSecurityModal(false)}
                onSuccess={() => {
                    setShowSecurityModal(false);
                    setTimeout(() => processTransaction(), 500);
                }}
                title="Authorize Purchase"
                description={selectedPlan ? `Confirm purchase of ${selectedPlan.name} for ${phoneNumber} @ ₦${selectedPlan.price}` : "Enter PIN"}
                requiredFor="purchase"
            />
        </View>
    );

    function BeneficiaryModal() {
        const filteredBens = beneficiaries.filter(b => 
            (b.name || '').toLowerCase().includes(beneficiarySearch.toLowerCase()) || 
            (b.account_number || '').includes(beneficiarySearch) ||
            (b.bank_name || '').toLowerCase().includes(beneficiarySearch.toLowerCase())
        );

        return (
            <Modal
                animationType="slide"
                transparent={true}
                visible={showBeneficiaryModal}
                onRequestClose={() => { setShowBeneficiaryModal(false); setBeneficiarySearch(''); }}
            >
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <View 
                        className="bg-white rounded-t-3xl h-[60%] p-5"
                        style={isWeb && { alignSelf: 'center', width: '100%', maxWidth: 450, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
                    >
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-xl font-bold text-gray-800">Select Beneficiary</Text>
                            <TouchableOpacity onPress={() => { setShowBeneficiaryModal(false); setBeneficiarySearch(''); }}>
                                <Ionicons name="close-circle" size={28} color="#9CA3AF" />
                            </TouchableOpacity>
                        </View>

                        {/* Beneficiary Search Input */}
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: '#f1f5f9',
                            borderRadius: 14,
                            paddingHorizontal: 12,
                            height: 44,
                            marginBottom: 16,
                            borderWidth: 1.5,
                            borderColor: '#e2e8f0',
                        }}>
                            <Ionicons name="search-outline" size={16} color="#94a3b8" />
                            <TextInput 
                                style={{ flex: 1, marginLeft: 8, fontSize: 13, color: '#0d1b3e', fontWeight: '500' }}
                                placeholder="Search by name or number..."
                                placeholderTextColor="#94a3b8"
                                value={beneficiarySearch}
                                onChangeText={setBeneficiarySearch}
                            />
                            {beneficiarySearch.length > 0 && (
                                <TouchableOpacity onPress={() => setBeneficiarySearch('')}>
                                    <Ionicons name="close-circle" size={16} color="#D1D5DB" />
                                </TouchableOpacity>
                            )}
                        </View>
                        
                        <FlatList
                            data={filteredBens}
                            keyExtractor={item => item.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    className="flex-row items-center p-4 border-b border-gray-100"
                                    onPress={() => {
                                        handlePhoneChange(item.account_number);
                                        setShowBeneficiaryModal(false);
                                        setBeneficiarySearch('');
                                    }}
                                >
                                    <LinearGradient
                                        colors={['#eff6ff', '#dbeafe']}
                                        style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
                                    >
                                        <Text style={{ color: '#1e40af', fontWeight: '800', fontSize: 14 }}>{item.name ? item.name[0].toUpperCase() : 'B'}</Text>
                                    </LinearGradient>
                                    <View style={{ flex: 1 }}>
                                        <Text className="font-bold text-gray-800" numberOfLines={1}>{item.name}</Text>
                                        <Text className="text-gray-500 text-xs" numberOfLines={1}>{item.bank_name} - {item.account_number}</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={
                                <View className="items-center py-10">
                                    <Text className="text-gray-400">No beneficiaries found</Text>
                                </View>
                            }
                        />
                    </View>
                </View>
            </Modal>
        );
    }
}

const s = StyleSheet.create({
  pageWrapper: {
    flex: 1,
    backgroundColor: '#f4f6fb',
  },
  webPageContainer: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 450,
  },
  headerContainer: {
    paddingTop: Platform.OS === 'ios' ? 54 : 40,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingHorizontal: 20,
    width: '100%',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  balanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 166, 35, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.25)',
  },
  headerBalance: {
    color: '#f5a623',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  scrollContainer: {
    paddingBottom: 40,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0d1b3e',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  networksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    width: '100%',
  },
  networkCard: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '22%',
    aspectRatio: 1.0,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    shadowColor: '#0a1633',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    position: 'relative',
  },
  networkCardSelected: {
    borderWidth: 2,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  networkLogoWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  networkLogo: {
    width: '80%',
    height: '80%',
  },
  networkName: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 4,
    color: '#64748b',
  },
  networkNameSelected: {
    color: '#0d1b3e',
    fontWeight: '800',
  },
  checkBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    borderRadius: 8,
    padding: 1,
  },
  inputBoxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 50,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    shadowColor: '#0a1633',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    width: '100%',
  },
  inputBoxFocused: {
    borderColor: '#0d1b3e',
  },
  inputBoxLogoWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#edf2f7',
  },
  inputBoxLogo: {
    width: '100%',
    height: '100%',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#0d1b3e',
  },
  beneficiaryBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  clearBtn: {
    padding: 4,
  },
  filterPill: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  filterPillActive: {
    backgroundColor: '#0d1b3e',
    borderColor: '#0d1b3e',
  },
  filterPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  filterPillTextActive: {
    color: '#ffffff',
  },
  plansContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
  },
  planCardWrapper: {
    width: '48.5%',
    marginBottom: 10,
  },
  planCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    shadowColor: '#0a1633',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    overflow: 'hidden',
  },
  planCardSelected: {
    borderColor: '#0d1b3e',
    borderWidth: 2,
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 5,
  },
  planCardGradient: {
    padding: 10,
    minHeight: 90,
    justifyContent: 'space-between',
  },
  planValidityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 4,
  },
  validityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  validityBadgeSelected: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  validityText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#475569',
  },
  validityTextSelected: {
    color: '#ffffff',
  },
  planName: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0d1b3e',
    lineHeight: 15,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  planNameSelected: {
    color: '#ffffff',
  },
  planPrice: {
    fontSize: 14,
    fontWeight: '900',
    color: '#2563eb',
  },
  planPriceSelected: {
    color: '#f5a623',
  },
  bestValueBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#f97316',
    borderBottomLeftRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    zIndex: 10,
  },
  bestValueText: {
    color: '#ffffff',
    fontSize: 6.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  quickRepeatCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  quickRepeatLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12,
  },
  quickRepeatIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  quickRepeatTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0d1b3e',
  },
  quickRepeatDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  bottomButtonWrapper: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    width: '100%',
  },
  purchaseBtn: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
    overflow: 'hidden',
  },
  purchaseBtnGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  purchaseBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  // USSD Codes styles
  ussdContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    marginBottom: 16,
    overflow: 'hidden',
    width: '100%',
  },
  ussdHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fffdf9',
  },
  ussdHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#78350f',
  },
  ussdContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#fef3c7',
    backgroundColor: '#ffffff',
  },
  ussdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  ussdNetName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0d1b3e',
  },
  ussdSubText: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  ussdActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
  },
  ussdActionText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0d1b3e',
    marginLeft: 3,
  },

  // Estimator styles
  estimatorContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    marginBottom: 16,
    overflow: 'hidden',
    width: '100%',
  },
  estimatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#f8fafc',
  },
  estimatorHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1e3a8a',
  },
  estimatorContent: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  estimatorIntro: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 12,
  },
  estimatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  estimatorLabel: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0d1b3e',
  },
  estimatorSubLabel: {
    fontSize: 9.5,
    color: '#64748b',
    marginTop: 1,
  },
  counterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 2,
  },
  counterBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  counterValue: {
    paddingHorizontal: 10,
    fontSize: 12,
    fontWeight: '800',
    color: '#0d1b3e',
    textAlign: 'center',
    minWidth: 32,
  },
  estimatorResultsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  resultBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultVal: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0d1b3e',
  },
  resultLbl: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 2,
  },
  recommendBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  recommendBtnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },

  // Recommendation Banner styles
  recommendationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  recommendationBannerText: {
    color: '#78350f',
    fontSize: 11,
    fontWeight: '600',
  },
  recommendationBannerClose: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  recommendationBannerCloseText: {
    color: '#b45309',
    fontSize: 10,
    fontWeight: '800',
  },

  // Options switch styles
  optionsContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    marginTop: 16,
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  optionTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0d1b3e',
  },
  optionDesc: {
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 2,
  },
  customSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center',
  },
  customSwitchOn: {
    backgroundColor: '#2563eb',
  },
  customSwitchOff: {
    backgroundColor: '#cbd5e1',
  },
  customSwitchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  customSwitchThumbOn: {
    alignSelf: 'flex-end',
  },
  customSwitchThumbOff: {
    alignSelf: 'flex-start',
  },
  giftInputContainer: {
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    justifyContent: 'center',
  },
  giftInput: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0d1b3e',
  },
});
