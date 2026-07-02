const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, '../app/manage/nin-pricing.tsx');
const bvnPath = path.join(__dirname, '../app/bvn-services.tsx');

// 1. Update app/manage/nin-pricing.tsx with bvn_basic, bvn_advanced, and bvn_card seeding
if (fs.existsSync(adminPath)) {
    let content = fs.readFileSync(adminPath, 'utf8');
    content = content.replace(/\r\n/g, '\n');

    // Replace the default BVN pricing array
    const oldBvnDefaults = `            // Auto-seed BVN pricing entries if missing
            const bvnPricingDefaults = [
                { id: 'bvn_validate', service_category: 'bvn', name: 'Validate BVN', cost_price: 500, markup_price: 0 },
                { id: 'bvn_slip', service_category: 'bvn', name: 'Print BVN Slip', cost_price: 800, markup_price: 0 },
                { id: 'bvn_modify', service_category: 'bvn', name: 'Modification Request', cost_price: 1000, markup_price: 0 }
            ];`;

    const newBvnDefaults = `            // Auto-seed BVN pricing entries if missing
            const bvnPricingDefaults = [
                { id: 'bvn_basic', service_category: 'bvn', name: 'Basic Details', cost_price: 150, markup_price: 0 },
                { id: 'bvn_advanced', service_category: 'bvn', name: 'Advanced Details', cost_price: 200, markup_price: 0 },
                { id: 'bvn_card', service_category: 'bvn', name: 'BVN Card Verification', cost_price: 250, markup_price: 0 }
            ];`;

    content = content.replace(oldBvnDefaults, newBvnDefaults);
    fs.writeFileSync(adminPath, content, 'utf8');
    console.log('Successfully updated nin-pricing.tsx with screenshot BVN defaults.');
}

// 2. Rewrite app/bvn-services.tsx to be the premium Verify BVN screen
const bvnCode = `import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, Modal, StyleSheet, Image, Platform } from 'react-native';
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
    bvn_basic: 150,
    bvn_advanced: 200,
    bvn_card: 250
};

export default function BVNVerificationScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    
    // Step 1: SEARCH TYPE - 'number' (BVN Number Verification) | 'card' (BVN Card Verification)
    const [searchType, setSearchType] = useState<'number' | 'card'>('number');
    
    // Step 2: DETAILS NEEDED - 'basic' | 'advanced'
    const [detailsNeeded, setDetailsNeeded] = useState<'basic' | 'advanced'>('basic');
    
    // Step 3: SUPPLY BVN NUMBER
    const [bvnNumber, setBvnNumber] = useState('');
    const [isAgreed, setIsAgreed] = useState(false);
    
    // Common States
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
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

    const getSelectedPrice = () => {
        if (searchType === 'card') {
            return prices.bvn_card;
        }
        return detailsNeeded === 'basic' ? prices.bvn_basic : prices.bvn_advanced;
    };

    const saveHistoryItem = async (verifiedData: any) => {
        try {
            const amount = getSelectedPrice();
            const newItem = {
                id: \`bvn_\${Date.now()}\`,
                target: bvnNumber.trim(),
                status: 'Completed',
                slip: searchType === 'card' 
                    ? 'BVN Card Verification' 
                    : \`BVN \${detailsNeeded === 'basic' ? 'Basic' : 'Advanced'} Verification\`,
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
    }, [searchType, detailsNeeded]);

    const handleVerify = async () => {
        const cleanVal = bvnNumber.trim();
        if (cleanVal.length !== 11) {
            return showAlert('Invalid Input', 'Please enter a valid 11-digit BVN or Phone Number.', 'warning');
        }
        if (!isAgreed) {
            return showAlert('Consent Required', 'You must confirm obtaining consent before running BVN verification.', 'warning');
        }

        const totalPrice = getSelectedPrice();
        if (userBalance !== null && userBalance < totalPrice) {
            return showAlert('Insufficient Balance', 'Your wallet balance is too low. Please fund your wallet and try again.', 'error');
        }

        setLoading(true);
        try {
            let res: any;
            
            // If the input starts with '0', it's a phone number linked-bvn lookup!
            if (cleanVal.startsWith('0')) {
                res = await api.identity.retrieveBVN(cleanVal);
            } else {
                // Otherwise, standard BVN verification or Card retrieval
                if (searchType === 'card') {
                    res = await api.identity.getBVNCard(cleanVal);
                } else {
                    res = await api.identity.validateBVN(cleanVal);
                }
            }

            if (res.isValid || res.status === 'success') {
                const finalData = res.data || res.rawData || res;
                setResult(finalData);
                await saveHistoryItem(finalData);
                await fetchWalletBalance();
            } else {
                showAlert('Verification Failed', res.message || 'Could not verify BVN details.', 'error');
            }
        } catch (e: any) {
            const errM = e.message || '';
            const lowerMsg = errM.toLowerCase();
            if (lowerMsg.includes('insufficient') || lowerMsg.includes('balance')) {
                showAlert('Insufficient Balance', 'Your wallet balance is too low. Please fund your wallet and try again.', 'error');
            } else {
                showAlert('Verification Failed', errM || 'An error occurred during verification.', 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    const getPhotoUrl = (data: any) => {
        const rawPhoto = data?.base64Image || data?.photo || data?.image || '';
        if (!rawPhoto) {
            return 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRL363G0d9u3u5YQ&s';
        }
        return rawPhoto.startsWith('data:') || rawPhoto.startsWith('http')
            ? rawPhoto
            : \`data:image/jpeg;base64,\${rawPhoto}\`;
    };

    if (result) {
        const photoUrl = getPhotoUrl(result);
        const fullName = [result.firstName || result.first_name, result.middleName || result.middle_name, result.lastName || result.last_name].filter(Boolean).join(' ') || 'RECORD HOLDER';
        
        return (
            <View style={styles.container}>
                <Stack.Screen options={{ 
                    title: 'Verification Result', 
                    headerStyle: { backgroundColor: '#060d21' }, 
                    headerTintColor: '#fff', 
                    headerShadowVisible: false,
                }} />
                
                {/* Result header */}
                <LinearGradient colors={['#060d21', '#121F42']} style={{ paddingTop: 24, paddingBottom: 48, paddingHorizontal: 16, alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="shield-checkmark" size={16} color="#f5a623" />
                        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13, marginLeft: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>BVN RECORD FOUND</Text>
                    </View>
                    <Text style={{ color: '#94a3b8', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 }}>Securely Verified</Text>
                </LinearGradient>

                <ScrollView style={{ flex: 1, paddingHorizontal: 12, marginTop: -32 }} contentContainerStyle={{ paddingBottom: 80 }}>
                    {/* Gorgeous ID card preview */}
                    <LinearGradient colors={['#1e293b', '#0f172a']} style={styles.idPreviewCard}>
                        {/* Watermark grid background pattern */}
                        <View style={styles.cardWatermarkGrid} />
                        
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text style={styles.cardLogoText}>BVN NIGERIA</Text>
                            <Ionicons name="wifi" size={18} color="#f5a623" style={{ transform: [{ rotate: '90deg' }] }} />
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                            <View style={styles.cardPortraitBox}>
                                <Image source={{ uri: photoUrl }} style={styles.cardPortrait} />
                            </View>
                            <View style={{ flex: 1, marginLeft: 16 }}>
                                <Text style={styles.cardFieldLabel}>HOLDER NAME</Text>
                                <Text style={styles.cardFieldVal} numberOfLines={1}>{fullName}</Text>

                                <Text style={[styles.cardFieldLabel, { marginTop: 10 }]}>BVN NUMBER</Text>
                                <Text style={styles.cardFieldVal}>{result.number || result.bvn || bvnNumber}</Text>
                            </View>
                        </View>

                        <View style={styles.cardBottomRow}>
                            <View>
                                <Text style={styles.cardFieldLabel}>DATE OF BIRTH</Text>
                                <Text style={styles.cardFieldVal}>{result.dateOfBirth || result.dob || '—'}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={styles.cardFieldLabel}>GENDER</Text>
                                <Text style={styles.cardFieldVal}>{(result.gender || '—').toUpperCase()}</Text>
                            </View>
                        </View>
                    </LinearGradient>

                    {/* Full details table */}
                    <View style={styles.detailsCard}>
                        <Text style={styles.detailsSectionTitle}>VERIFICATION SCHEDULING DETAILS</Text>
                        
                        {[
                            { label: 'FIRST NAME', value: result.firstName || result.first_name || '—' },
                            { label: 'MIDDLE NAME', value: result.middleName || result.middle_name || '—' },
                            { label: 'LAST NAME', value: result.lastName || result.last_name || '—' },
                            { label: 'NIN LINKED', value: result.nin || result.NIN || '—' },
                            { label: 'PRIMARY PHONE', value: result.phoneNumber1 || result.phone || '—' },
                            { label: 'ENROLLMENT BANK', value: result.enrollmentBank || result.bank || '—' },
                            { label: 'ENROLLMENT BRANCH', value: result.enrollmentBranch || '—' },
                            { label: 'STATE OF ORIGIN', value: result.stateOfOrigin || '—' },
                            { label: 'STATE OF RESIDENCE', value: result.stateOfResidence || '—' },
                            { label: 'LGA OF ORIGIN', value: result.lgaOfOrigin || '—' },
                            { label: 'MARITAL STATUS', value: result.maritalStatus || '—' },
                            { label: 'RESIDENTIAL ADDRESS', value: result.residentialAddress || '—' }
                        ].map((row, idx) => (
                            <View key={idx} style={styles.detailsRow}>
                                <Text style={styles.detailsLabel}>{row.label}</Text>
                                <Text style={styles.detailsValue}>{row.value}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Back Button */}
                    <TouchableOpacity 
                        onPress={() => setResult(null)} 
                        style={styles.actionBtn}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.actionBtnText}>RUN ANOTHER SEARCH</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ 
                title: 'BVN Verification', 
                headerStyle: { backgroundColor: '#060d21' }, 
                headerTintColor: '#fff', 
                headerShadowVisible: false,
                headerRight: () => (
                    <TouchableOpacity onPress={() => router.push('/nin-services/history?tab=bvn')} style={{ marginRight: 8 }}>
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
                            <Text style={styles.loaderTitle}>Processing Verification</Text>
                            <Text style={styles.loaderSub}>Connecting to NIBSS Security Registry...</Text>
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

            <ScrollView style={{ flex: 1, paddingHorizontal: 12 }} contentContainerStyle={styles.scrollContent}>
                
                {/* Wallet Balance widget */}
                <View style={[styles.walletBar, { marginTop: 16 }]}>
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

                {/* 1. SEARCH TYPE */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={styles.stepBadge}>
                            <Text style={styles.stepBadgeText}>1</Text>
                        </View>
                        <Text style={styles.cardTitle}>SEARCH TYPE</Text>
                    </View>

                    <View style={styles.choiceGrid}>
                        <TouchableOpacity 
                            onPress={() => setSearchType('number')}
                            style={[
                                styles.choiceCell,
                                searchType === 'number' ? styles.choiceSelected : styles.choiceUnselected
                            ]}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="finger-print" size={18} color={searchType === 'number' ? '#060d21' : '#64748b'} />
                            <Text style={[styles.choiceLabel, searchType === 'number' ? styles.textSelected : styles.textUnselected]}>
                                BVN Number Verification
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={() => setSearchType('card')}
                            style={[
                                styles.choiceCell,
                                searchType === 'card' ? styles.choiceSelected : styles.choiceUnselected
                            ]}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="card-outline" size={18} color={searchType === 'card' ? '#060d21' : '#64748b'} />
                            <Text style={[styles.choiceLabel, searchType === 'card' ? styles.textSelected : styles.textUnselected]}>
                                BVN Card Verification
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* 2. DETAILS NEEDED */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={styles.stepBadge}>
                            <Text style={styles.stepBadgeText}>2</Text>
                        </View>
                        <Text style={styles.cardTitle}>DETAILS NEEDED</Text>
                    </View>

                    {searchType === 'number' ? (
                        <View style={styles.choiceGrid}>
                            <TouchableOpacity 
                                onPress={() => setDetailsNeeded('basic')}
                                style={[
                                    styles.choiceCell,
                                    detailsNeeded === 'basic' ? styles.choiceSelected : styles.choiceUnselected
                                ]}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.choicePrice, detailsNeeded === 'basic' ? styles.textSelected : styles.textUnselected]}>
                                    ₦{prices.bvn_basic.toFixed(2)}
                                </Text>
                                <Text style={[styles.choiceLabel, detailsNeeded === 'basic' ? styles.textSelected : styles.textUnselected]}>
                                    Basic Details
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                onPress={() => setDetailsNeeded('advanced')}
                                style={[
                                    styles.choiceCell,
                                    detailsNeeded === 'advanced' ? styles.choiceSelected : styles.choiceUnselected
                                ]}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.choicePrice, detailsNeeded === 'advanced' ? styles.textSelected : styles.textUnselected]}>
                                    ₦{prices.bvn_advanced.toFixed(2)}
                                </Text>
                                <Text style={[styles.choiceLabel, detailsNeeded === 'advanced' ? styles.textSelected : styles.textUnselected]}>
                                    Advanced Details
                                </Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={[styles.choiceGrid, { justifyContent: 'center' }]}>
                            <TouchableOpacity 
                                style={[styles.choiceCell, styles.choiceSelected, { width: '60%' }]}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.choicePrice, styles.textSelected]}>
                                    ₦{prices.bvn_card.toFixed(2)}
                                </Text>
                                <Text style={[styles.choiceLabel, styles.textSelected]}>
                                    BVN Card Verification
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* 3. SUPPLY BVN NUMBER */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={styles.stepBadge}>
                            <Text style={styles.stepBadgeText}>3</Text>
                        </View>
                        <Text style={styles.cardTitle}>SUPPLY BVN NUMBER</Text>
                    </View>

                    {/* Blue Info Dial Box */}
                    <View style={styles.infoDialBox}>
                        <Ionicons name="information-circle" size={16} color="#0284c7" style={{ marginRight: 8, marginTop: 1 }} />
                        <Text style={styles.infoDialText}>
                            Dial <Text style={{ fontWeight: '800' }}>*565*0#</Text> from your registered phone number to get your BVN.
                        </Text>
                    </View>

                    <View style={{ marginBottom: 12, marginTop: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                            <Ionicons name="finger-print-outline" size={14} color="#64748b" style={{ marginRight: 6 }} />
                            <Text style={styles.labelHeader}>BVN NUMBER</Text>
                        </View>
                        <View style={styles.inputContainer}>
                            <TextInput
                                placeholder="22000000000"
                                placeholderTextColor="#cbd5e1"
                                style={styles.inputStyleCentered}
                                value={bvnNumber} 
                                onChangeText={setBvnNumber} 
                                keyboardType="number-pad"
                                maxLength={11}
                                editable={!loading}
                            />
                        </View>
                        <Text style={styles.inputHelperText}>
                            We'll never share your details with anyone else.
                        </Text>
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
                        disabled={loading || bvnNumber.trim().length !== 11 || !isAgreed} 
                        style={[
                            styles.verifyButton,
                            (loading || bvnNumber.trim().length !== 11 || !isAgreed) ? styles.verifyButtonDisabled : styles.verifyButtonActive
                        ]}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="finger-print" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                        <Text style={styles.verifyButtonText}>Verify</Text>
                    </TouchableOpacity>
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
    choiceGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
    },
    choiceCell: {
        borderRadius: 16,
        padding: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        width: '48.5%',
        minHeight: 84,
    },
    choiceSelected: {
        backgroundColor: '#ffffff',
        borderColor: '#060d21',
        shadowColor: '#060d21',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
    },
    choiceUnselected: {
        backgroundColor: '#ffffff',
        borderColor: '#cbd5e1',
    },
    choicePrice: {
        fontSize: 12,
        fontWeight: '900',
        marginBottom: 6,
    },
    choiceLabel: {
        fontSize: 10.5,
        fontWeight: '800',
        textAlign: 'center',
    },
    textSelected: {
        color: '#060d21',
    },
    textUnselected: {
        color: '#64748b',
    },
    infoDialBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#eff6ff',
        borderWidth: 1,
        borderColor: '#bfdbfe',
        borderRadius: 12,
        padding: 12,
    },
    infoDialText: {
        color: '#0284c7',
        fontSize: 11.5,
        fontWeight: '600',
        flex: 1,
        lineHeight: 16,
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
        fontSize: 18,
        textAlign: 'center',
        letterSpacing: 2,
    },
    inputHelperText: {
        color: '#94a3b8',
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
    idPreviewCard: {
        borderRadius: 24,
        padding: 20,
        marginBottom: 16,
        position: 'relative',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 15,
        elevation: 5,
    },
    cardWatermarkGrid: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0.05,
        borderWidth: 1,
        borderColor: '#ffffff',
    },
    cardLogoText: {
        color: '#f5a623',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 1.5,
    },
    cardPortraitBox: {
        width: 80,
        height: 96,
        borderRadius: 12,
        backgroundColor: '#334155',
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: '#475569',
    },
    cardPortrait: {
        width: '100%',
        height: '100%',
    },
    cardFieldLabel: {
        fontSize: 8,
        color: '#64748b',
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    cardFieldVal: {
        fontSize: 13,
        fontWeight: '800',
        color: '#ffffff',
        marginTop: 1,
        letterSpacing: 0.2,
    },
    cardBottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 20,
        borderTopWidth: 1,
        borderTopColor: '#334155',
        paddingTop: 12,
    },
    detailsCard: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    detailsSectionTitle: {
        fontSize: 10,
        fontWeight: '900',
        color: '#060d21',
        marginBottom: 16,
        letterSpacing: 0.8,
    },
    detailsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    detailsLabel: {
        fontSize: 9.5,
        color: '#64748b',
        fontWeight: '800',
        width: '40%',
    },
    detailsValue: {
        fontSize: 11,
        color: '#0f172a',
        fontWeight: '700',
        textAlign: 'right',
        width: '58%',
    },
    actionBtn: {
        backgroundColor: '#060d21',
        height: 48,
        borderRadius: 14,
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
    actionBtnText: {
        color: '#ffffff',
        fontWeight: '900',
        fontSize: 13.5,
        letterSpacing: 0.5,
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

fs.writeFileSync(bvnPath, bvnCode, 'utf8');
console.log('Successfully completed full modernization of bvn-services.tsx to matching screenshot layout!');
