const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../app/nin-services/ipe-clearance.tsx');

const modernizedIpeCode = `import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Dimensions, Image, Platform, Modal, StyleSheet } from 'react-native';
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
    { id: 'ipe_inprocessing', db_id: 'ipe_inprocessing', name: 'InProcessing Error', price: 700 },
    { id: 'ipe_still_processed', db_id: 'ipe_still_processed', name: 'Still Being Processed', price: 700 },
    { id: 'ipe_new_enrollment', db_id: 'ipe_new_enrollment', name: 'New Enrollment For Tracking ID', price: 700 },
    { id: 'ipe_invalid_tracking', db_id: 'ipe_invalid_tracking', name: 'Invalid Tracking ID', price: 700 }
];

const DEFAULT_SLIP_TYPES = [
    { id: 'ipe_slip_regular', db_id: 'ipe_slip_regular', name: 'Regular', price: 0, image: require('../../assets/images/regular.png') },
    { id: 'ipe_slip_premium', db_id: 'ipe_slip_premium', name: 'Premium', price: 150, image: require('../../assets/images/premium.png') }
];

export default function IPEClearanceScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    
    // Selection States
    const [selectedStatus, setSelectedStatus] = useState('ipe_still_processed');
    const [selectedSlip, setSelectedSlip] = useState('ipe_slip_premium');
    
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
            const stored = await AsyncStorage.getItem('recent_ipe_clearances');
            if (stored) {
                setHistoryList(JSON.parse(stored));
            }
        } catch (e) {
            console.warn('Failed to load history', e);
        }
    };

    const saveHistoryItem = async (verifiedData: any) => {
        try {
            const statusLabel = statusTypes.find(s => s.id === selectedStatus)?.name || 'Clearance';
            const newItem = {
                id: \`ipe_\${Date.now()}\`,
                target: nin.trim(),
                status: statusLabel,
                date: (() => {
                    const d = new Date();
                    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    const pad = (n: number) => n.toString().padStart(2, '0');
                    return \`\${d.getDate()} \${months[d.getMonth()]} \${d.getFullYear()}, \${pad(d.getHours())}:\${pad(d.getMinutes())}\`;
                })(),
                data: verifiedData
            };
            
            const updated = [newItem, ...historyList.filter(item => item.target !== newItem.target)].slice(0, 50);
            setHistoryList(updated);
            await AsyncStorage.setItem('recent_ipe_clearances', JSON.stringify(updated));
        } catch (e) {
            console.warn('Failed to save history item', e);
        }
    };

    const deleteHistoryItem = async (itemId: string) => {
        try {
            const updated = historyList.filter(item => item.id !== itemId);
            setHistoryList(updated);
            await AsyncStorage.setItem('recent_ipe_clearances', JSON.stringify(updated));
        } catch (e) {
            console.warn('Failed to delete history item', e);
        }
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
            const { data, error } = await supabase.from('service_pricing').select('*').eq('service_category', 'ipe');
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
            return showAlert('Tracking ID Required', 'Please enter a valid Tracking ID.', 'warning');
        }
        if (!isAgreed) {
            return showAlert('Consent Required', 'You must confirm obtaining consent before running clearance.', 'warning');
        }

        const totalPrice = getSelectedTotalPrice();
        if (userBalance !== null && userBalance < totalPrice) {
            return showAlert('Insufficient Balance', 'Your wallet balance is too low. Please fund your wallet and try again.', 'error');
        }

        setLoading(true);
        try {
            const res = await api.identity.runIPEClearance(cleanNin);
            setResult(res);
            await saveHistoryItem(res);
            await fetchWalletBalance(); // Update balance
        } catch (e: any) {
            const errM = e.message || '';
            const lowerMsg = errM.toLowerCase();
            if (lowerMsg.includes('insufficient') || lowerMsg.includes('balance')) {
                showAlert('Insufficient Balance', 'Your wallet balance is too low. Please fund your wallet and try again.', 'error');
            } else if (lowerMsg.includes('not found') || lowerMsg.includes('no record') || lowerMsg.includes('does not exist') || lowerMsg.includes('not exist') || lowerMsg.includes('invalid or not found')) {
                showAlert('No Record Found', 'The record or identity you entered does not exist or has no clearance history.', 'error');
            } else {
                showAlert('Clearance Failed', errM || 'An error occurred during clearance checks.', 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    const faqs = [
        { q: 'Menene IPE Clearance?', a: 'IPE Clearance wani tsari ne na tantance ingancin lambar NIN ko Tracking ID don tabbatar da cewa babu wata matsala game da bayanan aikin ma\\\'aikaci kafin a ɗauke shi aiki.' },
        { q: 'Yaya ake biyan kuɗin wannan sabis?', a: 'Ana cire kuɗi kaɗan daga balance ɗinka na tantancewa da zarar an sami nasarar runing clearance.' },
        { q: 'Zan iya sake duba clearance na baya?', a: 'Ee, tarihin dukan clearance ɗin da ka gudanar yana nan a ƙasan shafin don sauƙin reprint ko duba status na baya.' }
    ];

    const filteredHistory = historyList.filter(item => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return true;
        return (
            (item.target || '').toLowerCase().includes(q) ||
            (item.status || '').toLowerCase().includes(q)
        );
    });

    if (result) {
        return (
            <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
                <Stack.Screen options={{ 
                    title: 'Clearance Status', 
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
                        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13, marginLeft: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Clearance Details</Text>
                    </View>
                    <Text style={{ color: '#94a3b8', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 }}>IPE Report Generated</Text>
                </LinearGradient>

                <ScrollView style={{ flex: 1, paddingHorizontal: 12, marginTop: -32 }} contentContainerStyle={{ paddingBottom: 80 }}>
                    <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, marginBottom: 16 }}>
                        <StatusResult result={result} title="IPE Status Report" />
                    </View>

                    {/* Back Button */}
                    <TouchableOpacity 
                        onPress={() => setResult(null)} 
                        style={{ height: 48, borderRadius: 12, backgroundColor: '#9A3412', alignItems: 'center', justifyContent: 'center', width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 }}
                        activeOpacity={0.8}
                    >
                        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 }}>RUN ANOTHER CLEARANCE</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ 
                title: 'IPE Clearance', 
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
                            <Text style={styles.loaderTitle}>Processing Clearance</Text>
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

            {/* Main Header Row */}
            <View style={styles.customHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={styles.headerIconContainer}>
                        <Ionicons name="shield-checkmark" size={22} color="#ffffff" />
                    </View>
                    <View style={{ marginLeft: 12 }}>
                        <Text style={styles.headerMainTitle}>IPE Clearance</Text>
                        <Text style={styles.headerSubTitle}>In-Personalization Error clearance</Text>
                    </View>
                </View>
            </View>

            <ScrollView style={{ flex: 1, paddingHorizontal: 12 }} contentContainerStyle={styles.scrollContent}>
                
                {/* Processing time badge */}
                <View style={styles.processingTimeBadge}>
                    <Ionicons name="time-outline" size={14} color="#d97706" style={{ marginRight: 6 }} />
                    <Text style={styles.processingTimeText}>
                        Processing time: <Text style={{ fontWeight: '800' }}>10 minutes to 24 hours</Text>
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

                {/* 1. STATUS TYPE */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={styles.stepBadge}>
                            <Text style={styles.stepBadgeText}>1</Text>
                        </View>
                        <Text style={styles.cardTitle}>STATUS TYPE</Text>
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

                {/* 2. SLIP TYPE (FOR CLEARANCE) */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={styles.stepBadge}>
                            <Text style={styles.stepBadgeText}>2</Text>
                        </View>
                        <Text style={styles.cardTitle}>SLIP TYPE (FOR CLEARANCE)</Text>
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
                                        ₦{item.price.toFixed(2)}
                                    </Text>
                                    <View style={styles.slipImageBox}>
                                        <Image source={item.image} style={styles.slipPreviewImage} resizeMode="contain" />
                                    </View>
                                    <Text style={[styles.slipLabel, isSelected ? styles.textSelected : styles.textUnselected]}>
                                        {item.name}
                                    </Text>
                                </TouchableOpacity>
                            )
                        })}
                    </View>
                </View>

                {/* 3. SUPPLY TRACKING ID */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={styles.stepBadge}>
                            <Text style={styles.stepBadgeText}>3</Text>
                        </View>
                        <Text style={styles.cardTitle}>SUPPLY TRACKING ID</Text>
                    </View>
                    
                    <View style={{ marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                            <Ionicons name="card-outline" size={14} color="#64748b" style={{ marginRight: 6 }} />
                            <Text style={styles.labelHeader}>Tracking ID</Text>
                        </View>
                        <View style={styles.inputContainer}>
                            <TextInput
                                placeholder="Enter Tracking ID"
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

                {/* Search Bar for past reprints */}
                {historyList.length > 0 && (
                    <View style={styles.searchContainer}>
                        <Ionicons name="search" size={16} color="#94a3b8" />
                        <TextInput
                            placeholder="Search past clearance (ID or status)..."
                            placeholderTextColor="#94a3b8"
                            style={styles.searchInput}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Ionicons name="close-circle" size={16} color="#94a3b8" />
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {/* RECENT LOOKUPS */}
                {filteredHistory.length > 0 && (
                    <View style={styles.card}>
                        <View style={styles.historyHeader}>
                            <Ionicons name="time" size={16} color="#f5a623" />
                            <Text style={styles.historyTitle}>Recent Clearances</Text>
                        </View>

                        <View style={{ flexDirection: 'column' }}>
                            {filteredHistory.map((item) => (
                                <View key={item.id} style={styles.historyItem}>
                                    <TouchableOpacity 
                                        onPress={() => {
                                            setNin(item.target);
                                            setResult(item.data);
                                        }}
                                        style={styles.historyItemLeft}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.historyIconContainer}>
                                            <Ionicons name="shield-checkmark" size={16} color="#060d21" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.historyName}>ID: {item.target}</Text>
                                            <Text style={styles.historyMeta}>Status: {item.status} • {item.date.split(',')[0]}</Text>
                                        </View>
                                    </TouchableOpacity>

                                    <View style={styles.historyRight}>
                                        <TouchableOpacity 
                                            onPress={() => deleteHistoryItem(item.id)}
                                            style={styles.deleteButton}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons name="trash-outline" size={14} color="#DC2626" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                )}
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
        paddingTop: 16,
        paddingBottom: 16,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    headerIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#9A3412',
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
    headerGradient: {
        paddingTop: 16,
        paddingBottom: 40,
        paddingHorizontal: 16,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    headerTitle: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: '900',
        letterSpacing: -0.5,
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
        backgroundColor: '#9A3412',
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    stepBadgeText: {
        color: '#ffffff',
        fontWeight: '950',
        fontSize: 11,
    },
    cardTitle: {
        color: '#334155',
        fontWeight: '850',
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
        backgroundColor: '#0284c7',
        borderColor: '#0284c7',
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
        shadowColor: '#9A3412',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 3,
    },
    verifyButtonActive: {
        backgroundColor: '#9A3412',
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
        borderColor: '#9A3412',
        shadowColor: '#9A3412',
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
        color: '#9A3412',
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
        minHeight: 120,
    },
    slipCardSelected: {
        backgroundColor: '#ffffff',
        borderColor: '#9A3412',
        shadowColor: '#9A3412',
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
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 16,
        paddingHorizontal: 12,
        height: 48,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 0.5,
        marginHorizontal: 4,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        color: '#1e293b',
        fontWeight: '600',
        fontSize: 13,
    },
    historyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    historyTitle: {
        color: '#1e293b',
        fontWeight: '700',
        fontSize: 13,
        letterSpacing: 0.5,
        marginLeft: 6,
    },
    historyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    historyItemLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 8,
    },
    historyIconContainer: {
        backgroundColor: '#f8fafc',
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    historyName: {
        color: '#1e293b',
        fontWeight: '800',
        fontSize: 12,
    },
    historyMeta: {
        color: '#64748b',
        fontWeight: '600',
        fontSize: 10,
        marginTop: 1,
    },
    historyRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    deleteButton: {
        padding: 6,
        borderRadius: 8,
        backgroundColor: '#fef2f2',
    },
});
`;

fs.writeFileSync(targetPath, modernizedIpeCode, 'utf8');
console.log('Successfully completed premium IPE layout configuration matching screenshot!');
