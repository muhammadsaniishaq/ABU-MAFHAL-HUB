import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Image, Modal, StyleSheet, Platform, KeyboardAvoidingView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../../services/supabase';
import { verificationHistory } from '../../../services/verificationHistory';
import * as Clipboard from 'expo-clipboard';
import ViewShot from 'react-native-view-shot';

const MODIFICATION_TYPES = [
    { 
        id: 'nin_mod_name', 
        code: '501', 
        name: 'Change of Name', 
        desc: 'Correct or update First Name, Surname or Middle Name', 
        price: 5500, 
        icon: 'person', 
        bgColor: '#eff6ff', 
        iconColor: '#2563eb' 
    },
    { 
        id: 'nin_mod_phone', 
        code: '502', 
        name: 'Change of Phone', 
        desc: 'Link a new phone number to registered NIN', 
        price: 5500, 
        icon: 'call', 
        bgColor: '#ecfdf5', 
        iconColor: '#059669' 
    },
    { 
        id: 'nin_mod_address', 
        code: '503', 
        name: 'Change of Address', 
        desc: 'Update residential address, State and LGA', 
        price: 5500, 
        icon: 'location', 
        bgColor: '#fef3c7', 
        iconColor: '#d97706' 
    },
    { 
        id: 'pers_status', 
        code: '504', 
        name: 'Personalization', 
        desc: 'Update marital status, gender or occupation', 
        price: 150, 
        icon: 'create', 
        bgColor: '#faf5ff', 
        iconColor: '#9333ea' 
    }
];

export default function NINModificationScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const viewShotRef = useRef<any>(null);

    // Form States
    const [selectedService, setSelectedService] = useState('nin_mod_name');
    const [nin, setNin] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [userBalance, setUserBalance] = useState<number | null>(null);
    const [historyList, setHistoryList] = useState<any[]>([]);

    // Specific Modification Inputs
    // 1. Name Change
    const [firstName, setFirstName] = useState('');
    const [middleName, setMiddleName] = useState('');
    const [surname, setSurname] = useState('');
    const [reasonForChange, setReasonForChange] = useState('Spelling Correction');

    // 2. Phone Change
    const [newPhone, setNewPhone] = useState('');
    const [oldPhone, setOldPhone] = useState('');

    // 3. Address Change
    const [residenceState, setResidenceState] = useState('');
    const [residenceLga, setResidenceLga] = useState('');
    const [residenceAddress, setResidenceAddress] = useState('');

    // 4. Personalization
    const [personalField, setPersonalField] = useState('Marital Status');
    const [personalValue, setPersonalValue] = useState('');

    // Modal format choice for downloading receipt
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);

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

    const currentServiceInfo = MODIFICATION_TYPES.find(m => m.id === selectedService) || MODIFICATION_TYPES[0];

    useEffect(() => {
        fetchWalletBalance();
        loadHistory();
    }, []);

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

    const loadHistory = async () => {
        try {
            const all = await verificationHistory.getAll();
            const mods = all.filter((item: any) => 
                (item.slip_type || item.type || '').toLowerCase().includes('mod') ||
                (item.slip || '').toLowerCase().includes('mod')
            );
            setHistoryList(mods);
        } catch (e) {
            console.warn('Failed to load modification history', e);
        }
    };

    const handlePasteNin = async () => {
        try {
            const text = await Clipboard.getStringAsync();
            if (text) {
                const cleaned = text.replace(/[^0-9]/g, '').slice(0, 11);
                setNin(cleaned);
            }
        } catch (e) {
            console.warn('Failed to paste Clipboard text', e);
        }
    };

    const handleProcessModification = async () => {
        const cleanNin = nin.trim();
        if (!cleanNin || cleanNin.length !== 11) {
            showAlert('Invalid NIN Number', 'Please enter a valid 11-digit National Identification Number.', 'warning');
            return;
        }

        // Validate specific inputs
        if (selectedService === 'nin_mod_name') {
            if (!firstName.trim() || !surname.trim()) {
                showAlert('Missing Name Fields', 'Please enter both the new First Name and Surname.', 'warning');
                return;
            }
        } else if (selectedService === 'nin_mod_phone') {
            if (!newPhone.trim() || newPhone.trim().length < 10) {
                showAlert('Invalid Phone Number', 'Please enter a valid new phone number (11 digits).', 'warning');
                return;
            }
        } else if (selectedService === 'nin_mod_address') {
            if (!residenceAddress.trim() || !residenceState.trim()) {
                showAlert('Missing Address', 'Please provide the new Residential Address and State.', 'warning');
                return;
            }
        } else if (selectedService === 'pers_status') {
            if (!personalValue.trim()) {
                showAlert('Missing Information', `Please enter the new value for ${personalField}.`, 'warning');
                return;
            }
        }

        // Balance Check
        if (userBalance !== null && userBalance < currentServiceInfo.price) {
            showAlert('Insufficient Balance', `Your wallet balance (₦${userBalance.toLocaleString()}) is below the required ₦${currentServiceInfo.price.toLocaleString()} for this service. Please fund your wallet.`, 'error');
            return;
        }

        setLoading(true);

        try {
            const refCode = `MOD-${currentServiceInfo.code}-${Math.floor(100000 + Math.random() * 900000)}`;

            const payload: any = {
                searchType: 'nin_modification',
                service_id: selectedService,
                code: currentServiceInfo.code,
                nin: cleanNin,
                amount: currentServiceInfo.price,
                reference: refCode
            };

            if (selectedService === 'nin_mod_name') {
                payload.first_name = firstName.trim();
                payload.middle_name = middleName.trim();
                payload.last_name = surname.trim();
                payload.reason = reasonForChange;
            } else if (selectedService === 'nin_mod_phone') {
                payload.new_phone = newPhone.trim();
                payload.old_phone = oldPhone.trim();
            } else if (selectedService === 'nin_mod_address') {
                payload.address = residenceAddress.trim();
                payload.state = residenceState.trim();
                payload.lga = residenceLga.trim();
            } else if (selectedService === 'pers_status') {
                payload.field = personalField;
                payload.value = personalValue.trim();
            }

            const { data, error } = await supabase.functions.invoke('verify-nin', {
                body: payload
            });

            if (error) {
                throw new Error(error.message || 'Failed to submit NIN modification request.');
            }

            const responseData = data?.data || data || {};
            
            const resObj = {
                id: refCode,
                reference: refCode,
                nin: cleanNin,
                serviceName: currentServiceInfo.name,
                code: currentServiceInfo.code,
                amount: currentServiceInfo.price,
                status: 'Processing',
                message: 'Your NIN modification request has been submitted successfully to NIMC portal for verification and approval.',
                data: payload,
                raw: responseData,
                date: new Date().toISOString()
            };

            setResult(resObj);
            await fetchWalletBalance();

            // Save into persistent history
            await verificationHistory.saveItem({
                nin: cleanNin,
                firstname: firstName || 'NIN Holder',
                surname: surname || '',
                slip_type: `MOD: ${currentServiceInfo.name}`,
                amount: currentServiceInfo.price,
                ref: refCode
            });

            loadHistory();
        } catch (e: any) {
            showAlert('Submission Error', e.message || 'An error occurred while submitting your NIN modification request. Please try again.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ 
                title: 'NIN Modifications', 
                headerStyle: { backgroundColor: '#060d21' }, 
                headerTintColor: '#f5a623', 
                headerShadowVisible: false,
                headerRight: () => (
                    <TouchableOpacity onPress={() => router.push('/nin-services/history')} style={{ marginRight: 8 }}>
                        <Ionicons name="time-outline" size={22} color="#f5a623" />
                    </TouchableOpacity>
                )
            }} />
            <StatusBar style="light" />

            {/* Custom Alert Modal */}
            <Modal transparent visible={customAlert.visible} animationType="fade" onRequestClose={() => setCustomAlert(prev => ({ ...prev, visible: false }))}>
                <View style={styles.alertOverlay}>
                    <View style={styles.alertCard}>
                        <View style={[styles.alertIconCircle, { backgroundColor: customAlert.type === 'error' ? '#fef2f2' : customAlert.type === 'warning' ? '#fffbeb' : '#ecfdf5' }]}>
                            <Ionicons 
                                name={customAlert.type === 'error' ? 'close-circle' : customAlert.type === 'warning' ? 'warning' : 'checkmark-circle'} 
                                size={36} 
                                color={customAlert.type === 'error' ? '#ef4444' : customAlert.type === 'warning' ? '#f59e0b' : '#10b981'} 
                            />
                        </View>
                        <Text style={styles.alertTitle}>{customAlert.title}</Text>
                        <Text style={styles.alertMessage}>{customAlert.message}</Text>
                        <TouchableOpacity style={styles.alertButton} onPress={() => setCustomAlert(prev => ({ ...prev, visible: false }))} activeOpacity={0.8}>
                            <Text style={styles.alertButtonText}>OK</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {result ? (
                /* Modification Receipt / Confirmation Result View */
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 60 }}>
                    <LinearGradient colors={['#060d21', '#0d1b3e']} style={{ paddingTop: insets.top > 0 ? insets.top + 12 : 24, paddingBottom: 54, paddingHorizontal: 16, alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="shield-checkmark" size={18} color="#f5a623" />
                            <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 15, marginLeft: 6 }}>Modification Submitted</Text>
                        </View>
                        <Text style={{ color: '#f5a623', fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 4 }}>
                            {result.serviceName} • CODE {result.code}
                        </Text>
                    </LinearGradient>

                    <View style={{ alignItems: 'center', marginTop: -42, paddingHorizontal: 16 }}>
                        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 6, borderWidth: 3, borderColor: '#34d399' }}>
                            <Ionicons name="checkmark-done-circle" size={54} color="#059669" />
                        </View>

                        <Text style={{ color: '#060d21', fontWeight: '900', fontSize: 18, textTransform: 'uppercase', marginTop: 12, textAlign: 'center' }}>
                            Request Processing
                        </Text>
                        <Text style={{ color: '#64748b', fontSize: 12, fontWeight: '600', marginTop: 4, textAlign: 'center', paddingHorizontal: 20 }}>
                            {result.message}
                        </Text>

                        {/* Summary Details Card Container */}
                        <View style={{ backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', width: '100%', maxWidth: 440, marginTop: 20, overflow: 'hidden', shadowColor: '#64748b', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 1 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                                <Text style={{ color: '#64748b', fontWeight: '800', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>REFERENCE</Text>
                                <Text style={{ color: '#060d21', fontWeight: '800', fontSize: 12 }}>{result.reference}</Text>
                            </View>

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                                <Text style={{ color: '#64748b', fontWeight: '800', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>NIN NUMBER</Text>
                                <Text style={{ color: '#060d21', fontWeight: '900', fontSize: 13, letterSpacing: 0.5 }}>{result.nin}</Text>
                            </View>

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                                <Text style={{ color: '#64748b', fontWeight: '800', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>MODIFICATION TYPE</Text>
                                <View style={{ backgroundColor: '#e0f2fe', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 99 }}>
                                    <Text style={{ color: '#0284c7', fontWeight: '900', fontSize: 11 }}>{result.serviceName}</Text>
                                </View>
                            </View>

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                                <Text style={{ color: '#64748b', fontWeight: '800', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>FEE PAID</Text>
                                <Text style={{ color: '#059669', fontWeight: '900', fontSize: 13 }}>₦{result.amount.toLocaleString()}</Text>
                            </View>

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 }}>
                                <Text style={{ color: '#64748b', fontWeight: '800', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>DATE & TIME</Text>
                                <Text style={{ color: '#475569', fontWeight: '700', fontSize: 12 }}>{new Date(result.date).toLocaleString()}</Text>
                            </View>
                        </View>

                        {/* Back Link */}
                        <TouchableOpacity 
                            onPress={() => setResult(null)} 
                            style={{ backgroundColor: '#d97706', height: 50, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: 440, marginTop: 20, shadowColor: '#d97706', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 3 }}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="add-circle-outline" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                            <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 15 }}>Submit Another Modification</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            ) : (
                /* Main Modification Input Form */
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 60 }}>
                        
                        {/* Header Banner */}
                        <LinearGradient colors={['#060d21', '#0d1b3e']} style={{ paddingTop: insets.top > 0 ? insets.top + 8 : 16, paddingBottom: 24, paddingHorizontal: 16, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="create" size={22} color="#f5a623" />
                                    <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 18, marginLeft: 8 }}>NIN Modifications</Text>
                                </View>
                                {userBalance !== null && (
                                    <View style={{ backgroundColor: 'rgba(245, 166, 35, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, borderWidth: 1, borderColor: 'rgba(245, 166, 35, 0.3)' }}>
                                        <Text style={{ color: '#f5a623', fontWeight: '900', fontSize: 11 }}>₦{userBalance.toLocaleString()}</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={{ color: '#cbd5e1', fontSize: 12, fontWeight: '500', marginTop: 6 }}>
                                Official NIMC Update Portal: Change Name, Phone Number, Address & Personal Details.
                            </Text>
                        </LinearGradient>

                        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
                            
                            {/* Service Selection Grid Cards */}
                            <Text style={styles.sectionTitle}>Select Modification Type</Text>
                            <View style={{ gap: 10, marginBottom: 16 }}>
                                {MODIFICATION_TYPES.map((mod) => {
                                    const isSelected = selectedService === mod.id;
                                    return (
                                        <TouchableOpacity
                                            key={mod.id}
                                            onPress={() => setSelectedService(mod.id)}
                                            style={[
                                                styles.modCard,
                                                isSelected && styles.modCardSelected
                                            ]}
                                            activeOpacity={0.8}
                                        >
                                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                                <View style={[styles.modIconBox, { backgroundColor: mod.bgColor }]}>
                                                    <Ionicons name={mod.icon as any} size={22} color={mod.iconColor} />
                                                </View>
                                                <View style={{ marginLeft: 12, flex: 1 }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <Text style={{ color: '#060d21', fontWeight: '900', fontSize: 14 }}>{mod.name}</Text>
                                                        <Text style={{ color: '#d97706', fontWeight: '900', fontSize: 14 }}>₦{mod.price.toLocaleString()}</Text>
                                                    </View>
                                                    <Text style={{ color: '#64748b', fontSize: 11, marginTop: 2, fontWeight: '500' }}>{mod.desc}</Text>
                                                </View>
                                            </View>
                                            {isSelected && (
                                                <View style={{ marginLeft: 10 }}>
                                                    <Ionicons name="checkmark-circle" size={22} color="#d97706" />
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Form Input Fields Card */}
                            <View style={styles.formCard}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                                    <Ionicons name="document-text" size={18} color="#d97706" />
                                    <Text style={{ color: '#060d21', fontWeight: '900', fontSize: 13, marginLeft: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                        {currentServiceInfo.name} Details
                                    </Text>
                                </View>

                                {/* NIN Input */}
                                <Text style={styles.inputLabel}>NIN Number (11 Digits) *</Text>
                                <View style={styles.inputBox}>
                                    <Ionicons name="card-outline" size={18} color="#64748b" style={{ marginRight: 8 }} />
                                    <TextInput 
                                        style={styles.textInput}
                                        placeholder="Enter 11-digit NIN"
                                        placeholderTextColor="#94a3b8"
                                        keyboardType="number-pad"
                                        maxLength={11}
                                        value={nin}
                                        onChangeText={setNin}
                                    />
                                    <TouchableOpacity onPress={handlePasteNin} style={styles.pasteBtn}>
                                        <Text style={styles.pasteBtnText}>PASTE</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Dynamic Modification Specific Form Inputs */}
                                {selectedService === 'nin_mod_name' && (
                                    <>
                                        <Text style={[styles.inputLabel, { marginTop: 12 }]}>New First Name *</Text>
                                        <View style={styles.inputBox}>
                                            <TextInput style={styles.textInput} placeholder="Enter New First Name" placeholderTextColor="#94a3b8" value={firstName} onChangeText={setFirstName} />
                                        </View>

                                        <Text style={[styles.inputLabel, { marginTop: 12 }]}>New Middle Name (Optional)</Text>
                                        <View style={styles.inputBox}>
                                            <TextInput style={styles.textInput} placeholder="Enter New Middle Name" placeholderTextColor="#94a3b8" value={middleName} onChangeText={setMiddleName} />
                                        </View>

                                        <Text style={[styles.inputLabel, { marginTop: 12 }]}>New Surname *</Text>
                                        <View style={styles.inputBox}>
                                            <TextInput style={styles.textInput} placeholder="Enter New Surname" placeholderTextColor="#94a3b8" value={surname} onChangeText={setSurname} />
                                        </View>

                                        <Text style={[styles.inputLabel, { marginTop: 12 }]}>Reason for Modification</Text>
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                                            {['Spelling Correction', 'Marriage', 'Court Order', 'Title Change'].map((r) => (
                                                <TouchableOpacity 
                                                    key={r}
                                                    onPress={() => setReasonForChange(r)}
                                                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: reasonForChange === r ? '#d97706' : '#cbd5e1', backgroundColor: reasonForChange === r ? '#fffbeb' : '#ffffff' }}
                                                >
                                                    <Text style={{ color: reasonForChange === r ? '#d97706' : '#475569', fontWeight: '800', fontSize: 11 }}>{r}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </>
                                )}

                                {selectedService === 'nin_mod_phone' && (
                                    <>
                                        <Text style={[styles.inputLabel, { marginTop: 12 }]}>New Phone Number *</Text>
                                        <View style={styles.inputBox}>
                                            <Ionicons name="call-outline" size={18} color="#64748b" style={{ marginRight: 8 }} />
                                            <TextInput style={styles.textInput} placeholder="Enter 11-digit New Phone Number" placeholderTextColor="#94a3b8" keyboardType="number-pad" maxLength={11} value={newPhone} onChangeText={setNewPhone} />
                                        </View>

                                        <Text style={[styles.inputLabel, { marginTop: 12 }]}>Old Registered Phone Number (Optional)</Text>
                                        <View style={styles.inputBox}>
                                            <Ionicons name="phone-portrait-outline" size={18} color="#64748b" style={{ marginRight: 8 }} />
                                            <TextInput style={styles.textInput} placeholder="Enter Old Phone Number if known" placeholderTextColor="#94a3b8" keyboardType="number-pad" maxLength={11} value={oldPhone} onChangeText={setOldPhone} />
                                        </View>
                                    </>
                                )}

                                {selectedService === 'nin_mod_address' && (
                                    <>
                                        <Text style={[styles.inputLabel, { marginTop: 12 }]}>State of Residence *</Text>
                                        <View style={styles.inputBox}>
                                            <TextInput style={styles.textInput} placeholder="e.g. Lagos, Kano, FCT" placeholderTextColor="#94a3b8" value={residenceState} onChangeText={setResidenceState} />
                                        </View>

                                        <Text style={[styles.inputLabel, { marginTop: 12 }]}>LGA of Residence *</Text>
                                        <View style={styles.inputBox}>
                                            <TextInput style={styles.textInput} placeholder="e.g. Ikeja, Municipal" placeholderTextColor="#94a3b8" value={residenceLga} onChangeText={setResidenceLga} />
                                        </View>

                                        <Text style={[styles.inputLabel, { marginTop: 12 }]}>Full Street Address *</Text>
                                        <View style={[styles.inputBox, { height: 74, alignItems: 'flex-start', paddingTop: 10 }]}>
                                            <TextInput style={[styles.textInput, { textAlignVertical: 'top' }]} placeholder="Enter new complete residential address" placeholderTextColor="#94a3b8" multiline numberOfLines={3} value={residenceAddress} onChangeText={setResidenceAddress} />
                                        </View>
                                    </>
                                )}

                                {selectedService === 'pers_status' && (
                                    <>
                                        <Text style={[styles.inputLabel, { marginTop: 12 }]}>Field to Personalize / Update</Text>
                                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, marginBottom: 12 }}>
                                            {['Marital Status', 'Gender', 'Occupation'].map((f) => (
                                                <TouchableOpacity 
                                                    key={f}
                                                    onPress={() => setPersonalField(f)}
                                                    style={{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: personalField === f ? '#d97706' : '#cbd5e1', backgroundColor: personalField === f ? '#fffbeb' : '#ffffff' }}
                                                >
                                                    <Text style={{ color: personalField === f ? '#d97706' : '#475569', fontWeight: '800', fontSize: 11 }}>{f}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>

                                        <Text style={styles.inputLabel}>New Value *</Text>
                                        <View style={styles.inputBox}>
                                            <TextInput style={styles.textInput} placeholder={`Enter new ${personalField}`} placeholderTextColor="#94a3b8" value={personalValue} onChangeText={setPersonalValue} />
                                        </View>
                                    </>
                                )}

                                {/* Price Summary & Proceed Button */}
                                <View style={{ marginTop: 20, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#f1f5f9', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <View>
                                        <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>Service Charge</Text>
                                        <Text style={{ color: '#060d21', fontWeight: '900', fontSize: 18 }}>₦{currentServiceInfo.price.toLocaleString()}</Text>
                                    </View>

                                    <TouchableOpacity 
                                        onPress={handleProcessModification}
                                        disabled={loading}
                                        style={{ backgroundColor: '#d97706', height: 48, paddingHorizontal: 24, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: '#d97706', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 3 }}
                                        activeOpacity={0.8}
                                    >
                                        {loading ? <ActivityIndicator color="#ffffff" size="small" /> : (
                                            <>
                                                <Ionicons name="send" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                                                <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 14 }}>Submit Update</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>

                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    sectionTitle: {
        color: '#060d21',
        fontWeight: '900',
        fontSize: 14,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 10,
    },
    modCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        flexDirection: 'row',
        alignItems: 'center',
        justify: 'space-between',
        shadowColor: '#64748b',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    modCardSelected: {
        borderColor: '#d97706',
        backgroundColor: '#fffbeb',
        borderWidth: 2,
    },
    modIconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    formCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginTop: 6,
        marginBottom: 20,
        shadowColor: '#64748b',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 1,
    },
    inputLabel: {
        color: '#334155',
        fontWeight: '800',
        fontSize: 12,
        marginBottom: 6,
    },
    inputBox: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        height: 48,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
    },
    textInput: {
        flex: 1,
        color: '#0f172a',
        fontWeight: '700',
        fontSize: 14,
    },
    pasteBtn: {
        backgroundColor: '#e2e8f0',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
    },
    pasteBtnText: {
        color: '#334155',
        fontWeight: '900',
        fontSize: 10,
    },

    // Custom Alert Modal Styles
    alertOverlay: {
        flex: 1,
        backgroundColor: 'rgba(6, 13, 33, 0.75)',
        alignItems: 'center',
        justify: 'center',
        padding: 24,
    },
    alertCard: {
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: 24,
        width: '100%',
        maxWidth: 340,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
    },
    alertIconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justify: 'center',
        marginBottom: 16,
    },
    alertTitle: {
        color: '#060d21',
        fontWeight: '900',
        fontSize: 17,
        textAlign: 'center',
        marginBottom: 8,
    },
    alertMessage: {
        color: '#64748b',
        fontSize: 13,
        fontWeight: '600',
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 20,
    },
    alertButton: {
        backgroundColor: '#060d21',
        height: 46,
        borderRadius: 12,
        width: '100%',
        alignItems: 'center',
        justify: 'center',
    },
    alertButtonText: {
        color: '#ffffff',
        fontWeight: '900',
        fontSize: 14,
    },
});
