const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../app/nin-services/verify-phone.tsx');

const modernizedCode = `import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Dimensions, Image, Platform, Modal, StyleSheet, Clipboard } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../services/supabase';
import { api } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IDCardMockup } from '../../components/IDCardMockup';

export default function VerifyPhoneScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    
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
            const stored = await AsyncStorage.getItem('recent_phone_verifications');
            if (stored) {
                setHistoryList(JSON.parse(stored));
            }
        } catch (e) {
            console.warn('Failed to load history', e);
        }
    };

    const saveHistoryItem = async (verifiedData: any) => {
        try {
            const name = \`\${verifiedData.firstname || ''} \${verifiedData.surname || ''}\`.trim() || 'Unknown Name';
            const newItem = {
                id: \`phone_\${Date.now()}\`,
                phone,
                name,
                date: (() => {
                    const d = new Date();
                    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    const pad = (n: number) => n.toString().padStart(2, '0');
                    return \`\${d.getDate()} \${months[d.getMonth()]} \${d.getFullYear()}, \${pad(d.getHours())}:\${pad(d.getMinutes())}\`;
                })(),
                data: verifiedData
            };
            
            const updated = [newItem, ...historyList.filter(item => item.phone !== newItem.phone)].slice(0, 50);
            setHistoryList(updated);
            await AsyncStorage.setItem('recent_phone_verifications', JSON.stringify(updated));
        } catch (e) {
            console.warn('Failed to save history item', e);
        }
    };

    const deleteHistoryItem = async (itemId: string) => {
        try {
            const updated = historyList.filter(item => item.id !== itemId);
            setHistoryList(updated);
            await AsyncStorage.setItem('recent_phone_verifications', JSON.stringify(updated));
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

    const handlePaste = async () => {
        try {
            const text = await Clipboard.getString();
            const clean = text.replace(/\\D/g, '').slice(0, 15);
            setPhone(clean);
            showAlert('Pasted Successfully', 'Phone number copied from your clipboard has been pasted.', 'success');
        } catch (e) {
            console.warn('Failed to paste from clipboard', e);
        }
    };

    useEffect(() => {
        loadHistory();
        fetchWalletBalance();
    }, []);

    const handleVerify = async () => {
        const cleanPhone = phone.trim();
        if (cleanPhone.length < 10) {
            return showAlert('Phone Number Invalid', 'Please enter a valid phone number (e.g. 080xxxxxxxx).', 'warning');
        }
        setLoading(true);
        try {
            const response = await api.identity.verifyNINWithPhone(cleanPhone);
            
            if (response.isValid && response.data) {
                let personData = response.data?.data ?? response.data;
                setResult(response);
                await saveHistoryItem(personData);
            } else {
                const msg = response.message || 'Unable to verify this phone number. Please check and try again.';
                const lowerMsg = msg.toLowerCase();
                if (lowerMsg.includes('insufficient') || lowerMsg.includes('balance')) {
                    showAlert('Insufficient Balance', 'Your wallet balance is too low. Please fund your wallet and try again.', 'error');
                } else if (lowerMsg.includes('unauthorized') || lowerMsg.includes('auth')) {
                    showAlert('Session Expired', 'Please log out and log in again, then retry.', 'error');
                } else if (lowerMsg.includes('not found') || lowerMsg.includes('no record') || lowerMsg.includes('does not exist') || lowerMsg.includes('not exist') || lowerMsg.includes('invalid or not found')) {
                    showAlert('No Record Found', 'The phone number you entered does not exist or has no linked record.', 'error');
                } else {
                    showAlert('Verification Failed', msg, 'error');
                }
            }
        } catch (e: any) {
            const errM = e.message || '';
            if (errM.toLowerCase().includes('not found') || errM.toLowerCase().includes('no record') || errM.toLowerCase().includes('does not exist') || errM.toLowerCase().includes('not exist') || errM.toLowerCase().includes('invalid or not found')) {
                showAlert('No Record Found', 'The phone number you entered does not exist or has no linked record.', 'error');
            } else {
                showAlert('Network Error', errM || 'A network error occurred. Please check your connection and try again.', 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    const faqs = [
        { q: 'Yaya tsarin binciken yake aiki?', a: 'Sanya lambar wayar da ke da alaƙa da NIN ɗin da kake nema, sannan danna Lookup Phone. Tsarin zai zaƙulo bayanan mutumin nan take.' },
        { q: 'Akwai kuɗi a wannan binciken?', a: 'Ee, ana cire ɗan ƙaramin kuɗi na tantancewa daga balance ɗinka kawai idan an samu nasarar zaƙulo bayanan katin.' },
        { q: 'Nawa ne tsawon lambar waya?', a: 'Tabbatar ka shigar da lambar waya ta gaskiya guda 10 zuwa 11 ba tare da ƙari na alamar + ko lambar ƙasa ba.' }
    ];

    // Filter history based on search
    const filteredHistory = historyList.filter(item => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return true;
        return (
            (item.name || '').toLowerCase().includes(q) ||
            (item.phone || '').includes(q)
        );
    });

    if (result) {
        const data = result.data || result.rawData || {};
        return (
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                <Stack.Screen options={{ title: 'Verification Result', headerStyle: { backgroundColor: '#060d21' }, headerTintColor: '#fff', headerShadowVisible: false }} />
                
                {/* Header Banner */}
                <LinearGradient colors={['#060d21', '#121F42']} style={{ paddingTop: insets.top > 0 ? insets.top + 12 : 24, paddingBottom: 48, paddingHorizontal: 16, alignItems: 'center', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="shield-checkmark" size={16} color="#f5a623" />
                        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13, marginLeft: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Verification Success</Text>
                    </View>
                    <Text style={{ color: '#94a3b8', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 }}>Phone Lookup Details</Text>
                </LinearGradient>

                <View style={{ marginTop: 24 }}>
                    {result.isValid ? <IDCardMockup data={data} /> : (
                        <View style={styles.errorBox}>
                            <Ionicons name="close-circle" size={36} color="#DC2626" />
                            <Text style={styles.errorText}>Failed to find record</Text>
                        </View>
                    )}
                    
                    <TouchableOpacity onPress={() => setResult(null)} style={styles.verifyButtonActive} activeOpacity={0.8}>
                        <Text style={styles.verifyButtonText}>SEARCH ANOTHER</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        );
    }

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: 'Verify by Phone', headerStyle: { backgroundColor: '#060d21' }, headerTintColor: '#fff', headerShadowVisible: false }} />
            <StatusBar style="light" />

            {/* Premium Loader Modal */}
            {loading && (
                <Modal transparent visible={loading} animationType="fade">
                    <View style={styles.loaderOverlay}>
                        <View style={styles.loaderCard}>
                            <ActivityIndicator size="large" color="#f5a623" />
                            <Text style={styles.loaderTitle}>Verifying Identity</Text>
                            <Text style={styles.loaderSub}>Connecting to NIMC Secure Gateway...</Text>
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
                <Text style={styles.headerTitle}>Verify by Phone</Text>
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
                        onPress={() => router.push('/fund-wallet')}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="add-circle" size={14} color="#ffffff" />
                        <Text style={styles.fundBtnText}>Fund</Text>
                    </TouchableOpacity>
                </View>

                {/* SUPPLY PHONE */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={styles.stepBadge}>
                            <Text style={styles.stepBadgeText}>1</Text>
                        </View>
                        <Text style={styles.cardTitle}>Phone Details</Text>
                    </View>
                    
                    <View style={{ marginBottom: 12 }}>
                        <Text style={styles.label}>Enter the phone number linked to the NIN.</Text>
                        <View style={styles.inputContainer}>
                            <Ionicons name="call" size={16} color="#94a3b8" />
                            <TextInput
                                placeholder="e.g. 08012345678"
                                placeholderTextColor="#94a3b8"
                                style={styles.inputStyle}
                                keyboardType="phone-pad" 
                                maxLength={15} 
                                value={phone} 
                                onChangeText={setPhone} 
                                editable={!loading}
                            />
                            {phone.length > 0 && (
                                <Text style={[
                                    styles.lenIndicator,
                                    phone.length >= 10 ? styles.lenIndicatorSuccess : styles.lenIndicatorWarning
                                ]}>
                                    {phone.length} len
                                </Text>
                            )}
                            <TouchableOpacity 
                                style={styles.pasteBtn} 
                                onPress={handlePaste}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="clipboard-outline" size={14} color="#060d21" />
                                <Text style={styles.pasteBtnText}>Paste</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Verify Button */}
                    <TouchableOpacity 
                        onPress={handleVerify} 
                        disabled={loading || phone.length < 10} 
                        style={[
                            styles.verifyButton,
                            (loading || phone.length < 10) ? styles.verifyButtonDisabled : styles.verifyButtonActive
                        ]}
                        activeOpacity={0.8}
                    >
                        {loading ? <ActivityIndicator color="#f5a623" size="small" /> : (
                            <Text style={styles.verifyButtonText}>LOOKUP PHONE</Text>
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

                {/* ID Analytics / Lookup Stats Widget */}
                {historyList.length > 0 && (
                    <View style={styles.statsCard}>
                        <View style={styles.statsHeader}>
                            <Ionicons name="analytics" size={16} color="#f5a623" />
                            <Text style={styles.statsTitle}>Lookup Stats</Text>
                        </View>
                        <View style={styles.statsGrid}>
                            <View style={styles.statBox}>
                                <Text style={styles.statNum}>{historyList.length}</Text>
                                <Text style={styles.statLabel}>Total Lookups</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statBox}>
                                <Text style={styles.statNum}>
                                    {historyList.filter(item => item.phone.startsWith('080') || item.phone.startsWith('090') || item.phone.startsWith('070') || item.phone.startsWith('081')).length}
                                </Text>
                                <Text style={styles.statLabel}>Nigerian Mobiles</Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* Search Bar for past reprints */}
                {historyList.length > 0 && (
                    <View style={styles.searchContainer}>
                        <Ionicons name="search" size={16} color="#94a3b8" />
                        <TextInput
                            placeholder="Search past lookups (Name or Phone)..."
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
                            <Text style={styles.historyTitle}>Recent Lookups</Text>
                        </View>

                        <View style={{ flexDirection: 'column' }}>
                            {filteredHistory.map((item) => (
                                <View key={item.id} style={styles.historyItem}>
                                    <TouchableOpacity 
                                        onPress={() => {
                                            setPhone(item.phone);
                                            setResult(item.data);
                                        }}
                                        style={styles.historyItemLeft}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.historyIconContainer}>
                                            <Ionicons name="call" size={16} color="#060d21" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.historyName}>{item.name}</Text>
                                            <Text style={styles.historyMeta}>Phone: {item.phone}</Text>
                                        </View>
                                    </TouchableOpacity>

                                    <View style={styles.historyRight}>
                                        <Text style={styles.historyDate}>{item.date.split(',')[0]}</Text>
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
    content: {
        padding: 12,
        paddingBottom: 50,
    },
    errorBox: {
        backgroundColor: '#fef2f2',
        padding: 24,
        borderRadius: 24,
        marginBottom: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#fee2e2',
    },
    errorText: {
        color: '#991b1b',
        fontWeight: '700',
        marginTop: 8,
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
    scrollContent: {
        paddingBottom: 80,
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
    lenIndicator: {
        fontSize: 10,
        fontWeight: '800',
        marginRight: 8,
    },
    lenIndicatorSuccess: {
        color: '#10b981',
    },
    lenIndicatorWarning: {
        color: '#f5a623',
    },
    pasteBtn: {
        backgroundColor: '#e2e8f0',
        borderRadius: 8,
        paddingHorizontal: 8,
        height: 28,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    pasteBtnText: {
        color: '#060d21',
        fontWeight: '800',
        fontSize: 10,
        marginLeft: 3,
    },
    verifyButton: {
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        width: '100%',
        marginTop: 12,
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
    statsCard: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
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
    statsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    statsTitle: {
        color: '#1e293b',
        fontWeight: '700',
        fontSize: 12,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        marginLeft: 6,
    },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    statBox: {
        flex: 1,
        alignItems: 'center',
    },
    statNum: {
        fontSize: 18,
        fontWeight: '900',
        color: '#0d1b3e',
    },
    statLabel: {
        fontSize: 9,
        color: '#64748b',
        fontWeight: '700',
        marginTop: 2,
    },
    statDivider: {
        width: 1,
        height: 28,
        backgroundColor: '#f1f5f9',
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
    historyDate: {
        color: '#94a3b8',
        fontWeight: '600',
        fontSize: 9,
        marginRight: 10,
    },
    deleteButton: {
        padding: 6,
        borderRadius: 8,
        backgroundColor: '#fef2f2',
    },
});
`;

fs.writeFileSync(filePath, modernizedCode, 'utf8');
console.log('Successfully completed full modernization of verify-phone.tsx!');
