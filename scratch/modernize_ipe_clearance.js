const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../app/nin-services/ipe-clearance.tsx');

const fullIpeCode = `import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Dimensions, Image, Platform, Modal, StyleSheet } from 'react-native';
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

export default function IPEClearanceScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [nin, setNin] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [isAgreed, setIsAgreed] = useState(false);

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
            const status = verifiedData.status || verifiedData.clearanceStatus || 'Active';
            const newItem = {
                id: \`ipe_\${Date.now()}\`,
                target: nin.trim(),
                status,
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

    useEffect(() => {
        loadHistory();
        fetchWalletBalance();
    }, []);

    const handleVerify = async () => {
        const cleanNin = nin.trim();
        if (!cleanNin) {
            return showAlert('NIN / Tracking ID Required', 'Please enter a valid NIN or Tracking ID.', 'warning');
        }
        if (!isAgreed) {
            return showAlert('Consent Required', 'You must confirm obtaining consent before running clearance.', 'warning');
        }

        setLoading(true);
        try {
            const res = await api.identity.runIPEClearance(cleanNin);
            setResult(res);
            await saveHistoryItem(res);
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
        { q: 'Menene IPE Clearance?', a: 'IPE Clearance wani tsari ne na tantance ingancin lambar NIN ko Tracking ID don tabbatar da cewa babu wata matsala game da bayanan aikin ma\'aikaci kafin a ɗauke shi aiki.' },
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
                <Stack.Screen options={{ title: 'Clearance Status', headerStyle: { backgroundColor: '#060d21' }, headerTintColor: '#fff', headerShadowVisible: false }} />
                
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
                        style={{ height: 48, borderRadius: 12, backgroundColor: '#060d21', alignItems: 'center', justifyContent: 'center', width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 }}
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
            <Stack.Screen options={{ title: 'IPE Clearance', headerStyle: { backgroundColor: '#060d21' }, headerTintColor: '#fff', headerShadowVisible: false }} />
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

            <LinearGradient colors={['#060d21', '#0B163A']} style={[styles.headerGradient, { paddingTop: insets.top > 0 ? insets.top + 10 : 24 }]}>
                <Text style={styles.headerTitle}>IPE Clearance Status</Text>
            </LinearGradient>

            <ScrollView style={{ flex: 1, paddingHorizontal: 12, marginTop: 12 }} contentContainerStyle={styles.scrollContent}>
                
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

                {/* 1. INPUT CARD */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={styles.stepBadge}>
                            <Text style={styles.stepBadgeText}>1</Text>
                        </View>
                        <Text style={styles.cardTitle}>Identity Details</Text>
                    </View>
                    
                    <View style={{ marginBottom: 12 }}>
                        <Text style={styles.label}>Submit Tracking ID or NIN for Instant Pre-Employment Clearance.</Text>
                        <View style={styles.inputContainer}>
                            <Ionicons name="shield-checkmark-outline" size={16} color="#94a3b8" />
                            <TextInput
                                placeholder="Enter Tracking ID or NIN"
                                placeholderTextColor="#94a3b8"
                                style={styles.inputStyle}
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
                            I confirm that I have obtained consent to run clearance checks on this identity.
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
                        {loading ? <ActivityIndicator color="#f5a623" size="small" /> : (
                            <Text style={styles.verifyButtonText}>SUBMIT CLEARANCE</Text>
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
        backgroundColor: '#f8fafc',
    },
    scrollContent: {
        paddingBottom: 80,
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
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9',
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
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    stepBadge: {
        backgroundColor: '#f5a623',
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    stepBadgeText: {
        color: '#060d21',
        fontWeight: '900',
        fontSize: 10,
    },
    cardTitle: {
        color: '#1e293b',
        fontWeight: '700',
        fontSize: 13,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    label: {
        color: '#64748b',
        fontSize: 11,
        marginBottom: 8,
        fontWeight: '600',
        lineHeight: 16,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 48,
        marginBottom: 8,
    },
    inputStyle: {
        flex: 1,
        marginLeft: 8,
        color: '#1e293b',
        fontWeight: '700',
        fontSize: 14,
    },
    consentContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        marginBottom: 16,
        paddingHorizontal: 4,
    },
    consentText: {
        color: '#475569',
        fontSize: 11,
        flex: 1,
        fontWeight: '600',
        lineHeight: 15,
    },
    checkboxBox: {
        width: 18,
        height: 18,
        borderRadius: 4,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
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
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        width: '100%',
    },
    verifyButtonActive: {
        backgroundColor: '#060d21',
    },
    verifyButtonDisabled: {
        backgroundColor: 'rgba(6, 13, 33, 0.5)',
    },
    verifyButtonText: {
        fontWeight: '800',
        color: '#ffffff',
        fontSize: 13,
        letterSpacing: 0.5,
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

fs.writeFileSync(targetPath, fullIpeCode, 'utf8');
console.log('Successfully completed full modernization of ipe-clearance.tsx!');
