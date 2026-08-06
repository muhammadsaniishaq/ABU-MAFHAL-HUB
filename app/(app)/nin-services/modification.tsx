import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Image, Modal, StyleSheet, Platform, KeyboardAvoidingView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../../services/supabase';
import { verificationHistory } from '../../../services/verificationHistory';
import * as Clipboard from 'expo-clipboard';

const MODIFICATION_SERVICES = [
    { id: 'nin_mod_name', name: 'Change of Name', code: '501', fee: 6000, icon: 'person-outline' },
    { id: 'nin_mod_phone', name: 'Change of Phone', code: '502', fee: 6000, icon: 'call-outline' },
    { id: 'nin_mod_address', name: 'Change of Address', code: '503', fee: 6000, icon: 'location-outline' },
];

export default function NINModificationScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    // Tab State
    const [selectedServiceId, setSelectedServiceId] = useState('nin_mod_name');
    
    // Terms Modal State — Pop up immediately on entry
    const [showTermsModal, setShowTermsModal] = useState(true);
    const [termsAccepted, setTermsAccepted] = useState(false);

    // Form Inputs
    const [targetNin, setTargetNin] = useState('');
    const [currentPhone, setCurrentPhone] = useState('');
    const [currentFullName, setCurrentFullName] = useState('');
    
    // Name Change Fields
    const [newFirstName, setNewFirstName] = useState('');
    const [newSurname, setNewSurname] = useState('');
    const [newMiddleName, setNewMiddleName] = useState('');

    // Phone Change Fields
    const [newPhoneToLink, setNewPhoneToLink] = useState('');

    // Address Change Fields
    const [newAddress, setNewAddress] = useState('');

    // Common Processing States
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [userBalance, setUserBalance] = useState<number | null>(null);

    // Custom Alert State
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

    // Dynamic Pricing State from Admin NIN Pricing (service_pricing)
    const [servicesList, setServicesList] = useState(MODIFICATION_SERVICES);
    const activeService = servicesList.find(s => s.id === selectedServiceId) || servicesList[0];

    useEffect(() => {
        fetchWalletBalance();
        fetchDynamicPrices();
    }, []);

    const fetchDynamicPrices = async () => {
        try {
            const { data } = await supabase
                .from('service_pricing')
                .select('*')
                .in('id', ['nin_mod_name', 'nin_mod_phone', 'nin_mod_address']);

            if (data && data.length > 0) {
                setServicesList(prev => prev.map(serv => {
                    const dbItem = data.find((d: any) => d.id === serv.id);
                    if (dbItem) {
                        const cost = parseFloat(dbItem.cost_price?.toString() || '0');
                        const markup = parseFloat(dbItem.markup_price?.toString() || '0');
                        const selling = dbItem.selling_price ? parseFloat(dbItem.selling_price.toString()) : (cost + markup);
                        const finalFee = selling > 0 ? selling : (cost + markup);
                        return {
                            ...serv,
                            fee: finalFee > 0 ? finalFee : serv.fee
                        };
                    }
                    return serv;
                }));
            }
        } catch (e) {
            console.warn('Failed to load dynamic modification pricing from service_pricing', e);
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

    const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
        setCustomAlert({
            visible: true,
            title,
            message,
            type
        });
    };

    const handlePaste = async (setter: (val: string) => void) => {
        try {
            const text = await Clipboard.getStringAsync();
            if (text) setter(text.trim());
        } catch (e) {
            console.warn('Clipboard paste error', e);
        }
    };

    const handleClearForm = () => {
        setTargetNin('');
        setCurrentPhone('');
        setCurrentFullName('');
        setNewFirstName('');
        setNewSurname('');
        setNewMiddleName('');
        setNewPhoneToLink('');
        setNewAddress('');
    };

    const handleFormSubmit = () => {
        if (!termsAccepted) {
            setShowTermsModal(true);
            return;
        }

        processSubmission();
    };

    const processSubmission = async () => {
        const cleanNin = targetNin.trim();
        if (!cleanNin || cleanNin.length !== 11) {
            showAlert('Invalid NIN Number', 'Please enter a valid 11-digit Target NIN Number.', 'warning');
            return;
        }

        // Validate active form
        if (selectedServiceId === 'nin_mod_name') {
            if (!newFirstName.trim() || !newSurname.trim()) {
                showAlert('Missing Required Name Fields', 'Please enter both the New First Name and New Surname.', 'warning');
                return;
            }
        } else if (selectedServiceId === 'nin_mod_phone') {
            if (!newPhoneToLink.trim() || newPhoneToLink.trim().length < 10) {
                showAlert('Invalid New Phone Number', 'Please enter a valid new phone number to link.', 'warning');
                return;
            }
        } else if (selectedServiceId === 'nin_mod_address') {
            if (!newAddress.trim()) {
                showAlert('Missing New Address', 'Please enter the complete new residential address.', 'warning');
                return;
            }
        }

        // Balance Check
        if (userBalance !== null && userBalance < activeService.fee) {
            showAlert('Insufficient Wallet Balance', `Your current balance (₦${userBalance.toLocaleString()}) is below the ₦${activeService.fee.toLocaleString()} modification fee. Please fund your wallet.`, 'error');
            return;
        }

        setLoading(true);

        try {
            const refCode = `MOD-${activeService.code}-${Math.floor(100000 + Math.random() * 900000)}`;

            const payload: any = {
                searchType: 'nin_modification',
                priceId: selectedServiceId,
                service_id: selectedServiceId,
                code: activeService.code,
                nin: cleanNin,
                amount: activeService.fee,
                reference: refCode
            };

            if (selectedServiceId === 'nin_mod_name') {
                payload.first_name = newFirstName.trim();
                payload.last_name = newSurname.trim();
                payload.middle_name = newMiddleName.trim();
                payload.current_phone = currentPhone.trim();
            } else if (selectedServiceId === 'nin_mod_phone') {
                payload.current_full_name = currentFullName.trim();
                payload.new_phone = newPhoneToLink.trim();
            } else if (selectedServiceId === 'nin_mod_address') {
                payload.current_full_name = currentFullName.trim();
                payload.current_phone = currentPhone.trim();
                payload.new_address = newAddress.trim();
            }

            const { data, error } = await supabase.functions.invoke('verify-nin', {
                body: payload
            });

            if (error) {
                throw new Error(error.message || 'Failed to submit modification request.');
            }

            const resObj = {
                id: refCode,
                reference: refCode,
                nin: cleanNin,
                serviceName: activeService.name,
                code: activeService.code,
                amount: activeService.fee,
                status: 'Processing',
                message: 'Your NIN modification request has been submitted successfully. Our admin team will process and update your NIMC record.',
                date: new Date().toISOString()
            };

            setResult(resObj);
            await fetchWalletBalance();

            // Save persistent history
            await verificationHistory.save({
                service_category: 'nin',
                service_type: `MOD: ${activeService.name}`,
                search_number: cleanNin,
                holder_name: currentFullName.trim() || newFirstName.trim() || 'NIN Holder',
                layout: activeService.name,
                details: { ref: refCode, amount: activeService.fee }
            });
        } catch (e: any) {
            showAlert('Submission Error', e.message || 'An error occurred while submitting your NIN modification request. Please try again.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ 
                title: 'NIN Modification Hub', 
                headerStyle: { backgroundColor: '#060d21' }, 
                headerTintColor: '#f5a623', 
                headerShadowVisible: false,
                headerRight: () => (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <TouchableOpacity onPress={() => setShowTermsModal(true)} style={styles.navHeaderBtn}>
                            <Ionicons name="shield-checkmark" size={18} color="#f5a623" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => router.push('/nin-services/history')} style={styles.navHeaderBtn}>
                            <Ionicons name="time-outline" size={18} color="#f5a623" />
                        </TouchableOpacity>
                    </View>
                )
            }} />
            <StatusBar style="light" />

            {/* Ultra-Clean Compact Navy & Gold Terms of Agreement Modal */}
            <Modal transparent visible={showTermsModal} animationType="fade" onRequestClose={() => setShowTermsModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.termsModalCard}>
                        
                        {/* Compact Header Banner */}
                        <LinearGradient colors={['#060d21', '#0f1b3d']} style={styles.termsHeaderGradient}>
                            <View style={styles.warningIconBg}>
                                <Ionicons name="warning" size={20} color="#f5a623" />
                            </View>
                            <View style={{ marginLeft: 10, flex: 1 }}>
                                <Text style={styles.termsTitle}>Terms of Agreement</Text>
                                <Text style={styles.termsSubtitle}>Please read and agree before proceeding.</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowTermsModal(false)} style={styles.closeModalBtn}>
                                <Ionicons name="close" size={18} color="#94a3b8" />
                            </TouchableOpacity>
                        </LinearGradient>

                        <ScrollView style={styles.termsScroll} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 14 }}>
                            
                            {/* Clause 1 */}
                            <View style={styles.termSectionCard}>
                                <View style={styles.termNumBadge}>
                                    <Text style={styles.termNumBadgeText}>1</Text>
                                </View>
                                <View style={{ flex: 1, marginLeft: 8 }}>
                                    <Text style={styles.termHeading}>Authorization to Act on Your Behalf</Text>
                                    <Text style={styles.termBody}>
                                        I, the user, authorize AgentHub and its trusted agents to access and use my personal data, including my NIN, to process the modification requested. I understand that AgentHub is an independent agent and is not affiliated with NIMC.
                                    </Text>
                                </View>
                            </View>

                            {/* Clause 2 */}
                            <View style={styles.termSectionCard}>
                                <View style={styles.termNumBadge}>
                                    <Text style={styles.termNumBadgeText}>2</Text>
                                </View>
                                <View style={{ flex: 1, marginLeft: 8 }}>
                                    <Text style={styles.termHeading}>Your Voluntary Consent</Text>
                                    <Text style={styles.termBody}>
                                        NIMC recommends that NIN modifications be done personally. By agreeing, I confirm that due to technical difficulty, illiteracy, or convenience, I voluntarily authorize AgentHub to perform this modification on my behalf. This applies whether I am the NIN owner or an agent acting with the full consent of the owner.
                                    </Text>
                                </View>
                            </View>

                            {/* Clause 3 - Highlighted Gold Box */}
                            <View style={styles.highlightTermBox}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                    <Ionicons name="alert-circle" size={16} color="#d97706" style={{ marginRight: 5 }} />
                                    <Text style={[styles.termHeading, { color: '#92400e', marginBottom: 0 }]}>3. Service Fees & No-Refund Policy</Text>
                                </View>
                                <Text style={[styles.termBody, { color: '#92400e', lineHeight: 16.5 }]}>
                                    I agree to pay the non-refundable service fee. I understand that wallet funds are non-withdrawable. If a service fails due to an Admin or provider error (as specified in our auto-refund logic), the fee will be credited to my wallet, but it cannot be withdrawn. A ₦0 charge for wrong submissions will be deducted from any refund.
                                </Text>
                            </View>

                            {/* Clause 4 */}
                            <View style={styles.termSectionCard}>
                                <View style={styles.termNumBadge}>
                                    <Text style={styles.termNumBadgeText}>4</Text>
                                </View>
                                <View style={{ flex: 1, marginLeft: 8 }}>
                                    <Text style={styles.termHeading}>Your Responsibilities</Text>
                                    <Text style={styles.termBody}>
                                        • I confirm all information I provide (like "New First Name" or "New Address") is 100% correct.{'\n'}
                                        • I will not submit the same request on another platform while it is PROCESSING here. Doing so will forfeit my payment.{'\n'}
                                        • If submitting for someone else, I confirm I have the NIN owner's full legal authorization.
                                    </Text>
                                </View>
                            </View>

                            {/* Clause 5 */}
                            <View style={styles.termSectionCard}>
                                <View style={styles.termNumBadge}>
                                    <Text style={styles.termNumBadgeText}>5</Text>
                                </View>
                                <View style={{ flex: 1, marginLeft: 8 }}>
                                    <Text style={styles.termHeading}>Provider Delays & Service Terms</Text>
                                    <Text style={styles.termBody}>
                                        • <Text style={{ fontWeight: '700', color: '#060d21' }}>Bank/SIM Updates:</Text> I understand that modifications reflect immediately on the NIMC portal, but banks and SIM providers may take a long time to sync. If I need this for an urgent bank transaction, I will not proceed.{'\n'}
                                        • <Text style={{ fontWeight: '700', color: '#060d21' }}>NIMC Delays:</Text> If NIMC's network is down, I agree to wait patiently and will not submit duplicate requests.{'\n'}
                                        • <Text style={{ fontWeight: '700', color: '#060d21' }}>Alias Emails:</Text> I understand that this platform uses secure, platform-owned "alias emails" to process all modifications.
                                    </Text>
                                </View>
                            </View>

                        </ScrollView>

                        {/* Action Footer */}
                        <View style={styles.termsFooterBox}>
                            <TouchableOpacity 
                                onPress={() => {
                                    setTermsAccepted(true);
                                    setShowTermsModal(false);
                                }} 
                                style={styles.termsAgreeBtn} 
                                activeOpacity={0.85}
                            >
                                <LinearGradient colors={['#f5a623', '#d97706']} style={styles.termsAgreeBtnGradient}>
                                    <Ionicons name="checkmark-circle" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                                    <Text style={styles.termsAgreeBtnText}>I have read, understood, and agreed to all terms</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Custom Alert Modal */}
            <Modal transparent visible={customAlert.visible} animationType="fade" onRequestClose={() => setCustomAlert(prev => ({ ...prev, visible: false }))}>
                <View style={styles.modalOverlay}>
                    <View style={styles.alertCard}>
                        <View style={[styles.alertIconCircle, { backgroundColor: customAlert.type === 'error' ? '#fef2f2' : customAlert.type === 'warning' ? '#fffbeb' : '#ecfdf5' }]}>
                            <Ionicons 
                                name={customAlert.type === 'error' ? 'close-circle' : customAlert.type === 'warning' ? 'warning' : 'checkmark-circle'} 
                                size={32} 
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
                /* Submission Confirmation View */
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 50 }}>
                    <LinearGradient colors={['#060d21', '#0d1b3e']} style={{ paddingTop: insets.top > 0 ? insets.top + 8 : 16, paddingBottom: 44, paddingHorizontal: 16, alignItems: 'center' }}>
                        <Ionicons name="shield-checkmark" size={18} color="#f5a623" />
                        <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 15, marginTop: 4 }}>Modification Submitted</Text>
                        <Text style={{ color: '#f5a623', fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 2 }}>
                            {result.serviceName}
                        </Text>
                    </LinearGradient>

                    <View style={{ alignItems: 'center', marginTop: -34, paddingHorizontal: 16, width: '100%', maxWidth: 440, alignSelf: 'center' }}>
                        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4, borderWidth: 2, borderColor: '#10b981' }}>
                            <Ionicons name="checkmark-done" size={38} color="#059669" />
                        </View>

                        <Text style={{ color: '#060d21', fontWeight: '800', fontSize: 16, textTransform: 'uppercase', marginTop: 10 }}>
                            Request Processing
                        </Text>
                        <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '500', marginTop: 3, textAlign: 'center', paddingHorizontal: 16, lineHeight: 16 }}>
                            {result.message}
                        </Text>

                        {/* Summary Details Card Container */}
                        <View style={{ backgroundColor: '#ffffff', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', width: '100%', marginTop: 16, overflow: 'hidden', shadowColor: '#64748b', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                                <Text style={{ color: '#64748b', fontWeight: '700', fontSize: 10, textTransform: 'uppercase' }}>REFERENCE</Text>
                                <Text style={{ color: '#060d21', fontWeight: '700', fontSize: 11 }}>{result.reference}</Text>
                            </View>

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                                <Text style={{ color: '#64748b', fontWeight: '700', fontSize: 10, textTransform: 'uppercase' }}>TARGET NIN</Text>
                                <Text style={{ color: '#060d21', fontWeight: '800', fontSize: 12 }}>{result.nin}</Text>
                            </View>

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                                <Text style={{ color: '#64748b', fontWeight: '700', fontSize: 10, textTransform: 'uppercase' }}>MODIFICATION TYPE</Text>
                                <View style={{ backgroundColor: '#fff7ed', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, borderWidth: 1, borderColor: '#ffedd5' }}>
                                    <Text style={{ color: '#d97706', fontWeight: '800', fontSize: 10 }}>{result.serviceName}</Text>
                                </View>
                            </View>

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                                <Text style={{ color: '#64748b', fontWeight: '700', fontSize: 10, textTransform: 'uppercase' }}>FEE PAID</Text>
                                <Text style={{ color: '#059669', fontWeight: '800', fontSize: 12 }}>₦{(result.amount || 0).toLocaleString()}</Text>
                            </View>

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14 }}>
                                <Text style={{ color: '#64748b', fontWeight: '700', fontSize: 10, textTransform: 'uppercase' }}>DATE & TIME</Text>
                                <Text style={{ color: '#475569', fontWeight: '600', fontSize: 11 }}>{new Date(result.date).toLocaleString()}</Text>
                            </View>
                        </View>

                        <TouchableOpacity 
                            onPress={() => setResult(null)} 
                            style={{ backgroundColor: '#060d21', height: 44, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', marginTop: 16, shadowColor: '#060d21', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 }}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="add-circle-outline" size={18} color="#f5a623" style={{ marginRight: 6 }} />
                            <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 13 }}>Submit Another Modification</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            ) : (
                /* Main Form View */
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 50 }}>
                        
                        {/* Header Banner - Ultra Modern Navy & Gold */}
                        <LinearGradient colors={['#060d21', '#0c183a', '#10224d']} style={{ paddingTop: insets.top > 0 ? insets.top + 6 : 14, paddingBottom: 18, paddingHorizontal: 16 }}>
                            <View style={{ maxWidth: 460, alignSelf: 'center', width: '100%' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(245, 166, 35, 0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(245, 166, 35, 0.3)', marginRight: 8 }}>
                                            <Ionicons name="create-outline" size={18} color="#f5a623" />
                                        </View>
                                        <View>
                                            <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 16 }}>NIN Modification Hub</Text>
                                            <Text style={{ color: '#f5a623', fontSize: 10, fontWeight: '600' }}>Direct NIMC Record Update</Text>
                                        </View>
                                    </View>
                                    {userBalance !== null && (
                                        <View style={{ backgroundColor: 'rgba(245, 166, 35, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, borderWidth: 1, borderColor: 'rgba(245, 166, 35, 0.35)' }}>
                                            <Text style={{ color: '#f5a623', fontWeight: '800', fontSize: 11 }}>₦{userBalance.toLocaleString()}</Text>
                                        </View>
                                    )}
                                </View>

                                {/* Step Tracker Bar */}
                                <View style={styles.stepProgressRow}>
                                    <View style={styles.stepItem}>
                                        <View style={[styles.stepDot, styles.stepDotActive]}><Text style={styles.stepDotNum}>1</Text></View>
                                        <Text style={[styles.stepText, styles.stepTextActive]}>Select Type</Text>
                                    </View>
                                    <View style={styles.stepLineActive} />
                                    <View style={styles.stepItem}>
                                        <View style={[styles.stepDot, targetNin.length === 11 && styles.stepDotActive]}><Text style={styles.stepDotNum}>2</Text></View>
                                        <Text style={[styles.stepText, targetNin.length === 11 && styles.stepTextActive]}>Fill Details</Text>
                                    </View>
                                    <View style={styles.stepLine} />
                                    <View style={styles.stepItem}>
                                        <View style={styles.stepDot}><Text style={styles.stepDotNum}>3</Text></View>
                                        <Text style={styles.stepText}>Submit</Text>
                                    </View>
                                </View>
                            </View>
                        </LinearGradient>

                        <View style={{ paddingHorizontal: 14, marginTop: 10, maxWidth: 460, width: '100%', alignSelf: 'center' }}>
                            
                            {/* Terms Badge Bar */}
                            <TouchableOpacity 
                                onPress={() => setShowTermsModal(true)} 
                                style={styles.termsBannerBox}
                                activeOpacity={0.8}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                    <Ionicons name="shield-checkmark" size={15} color="#d97706" style={{ marginRight: 6 }} />
                                    <Text style={{ color: '#78350f', fontWeight: '700', fontSize: 11 }}>
                                        {termsAccepted ? 'Terms Accepted ✓' : 'Terms of Agreement Required'}
                                    </Text>
                                </View>
                                <Text style={{ color: '#d97706', fontWeight: '700', fontSize: 10 }}>Review Terms →</Text>
                            </TouchableOpacity>

                            {/* Selector Header Bar */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, marginTop: 2 }}>
                                <Text style={{ color: '#334155', fontWeight: '700', fontSize: 11.5 }}>
                                    Select Modification Type
                                </Text>
                                {(targetNin || newFirstName || newPhoneToLink || newAddress) ? (
                                    <TouchableOpacity onPress={handleClearForm} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Ionicons name="refresh-outline" size={12} color="#64748b" style={{ marginRight: 2 }} />
                                        <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '600' }}>Clear Form</Text>
                                    </TouchableOpacity>
                                ) : null}
                            </View>

                            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                                {servicesList.map((serv) => {
                                    const isSel = selectedServiceId === serv.id;
                                    return (
                                        <TouchableOpacity
                                            key={serv.id}
                                            onPress={() => setSelectedServiceId(serv.id)}
                                            style={[
                                                styles.selectorTab,
                                                isSel && styles.selectorTabActive
                                            ]}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons name={serv.icon as any} size={13} color={isSel ? '#f5a623' : '#64748b'} style={{ marginRight: 4 }} />
                                            <Text style={[styles.selectorTabText, isSel && styles.selectorTabTextActive]} numberOfLines={1}>
                                                {serv.name}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Main Form Container Card */}
                            <View style={styles.mainFormCard}>
                                
                                {/* Target NIN */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, marginTop: 4 }}>
                                    <Text style={styles.fieldLabel}>Target NIN</Text>
                                    <Text style={{ fontSize: 9.5, fontWeight: '700', color: targetNin.length === 11 ? '#059669' : '#94a3b8' }}>
                                        {targetNin.length}/11 Digits {targetNin.length === 11 ? '✓' : ''}
                                    </Text>
                                </View>

                                <View style={styles.fieldInputBox}>
                                    <Ionicons name="card-outline" size={16} color="#94a3b8" style={{ marginRight: 6 }} />
                                    <TextInput 
                                        style={styles.fieldTextInput}
                                        placeholder="11-digit NIN"
                                        placeholderTextColor="#94a3b8"
                                        keyboardType="number-pad"
                                        maxLength={11}
                                        value={targetNin}
                                        onChangeText={setTargetNin}
                                    />
                                    <TouchableOpacity onPress={() => handlePaste(setTargetNin)} style={styles.pasteTag}>
                                        <Text style={styles.pasteTagText}>PASTE</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Dynamic Form Fields per Selected Tab */}

                                {/* TAB 1: Change of Name */}
                                {selectedServiceId === 'nin_mod_name' && (
                                    <>
                                        <Text style={styles.fieldLabel}>Current Phone Number linked to NIN</Text>
                                        <View style={styles.fieldInputBox}>
                                            <Ionicons name="call-outline" size={16} color="#94a3b8" style={{ marginRight: 6 }} />
                                            <TextInput 
                                                style={styles.fieldTextInput} 
                                                placeholder="08012345678" 
                                                placeholderTextColor="#94a3b8" 
                                                keyboardType="number-pad"
                                                maxLength={11}
                                                value={currentPhone} 
                                                onChangeText={setCurrentPhone} 
                                            />
                                        </View>

                                        <View style={{ flexDirection: 'row', gap: 8 }}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.fieldLabel}>New First Name</Text>
                                                <View style={styles.fieldInputBox}>
                                                    <TextInput style={styles.fieldTextInput} placeholder="First name" placeholderTextColor="#94a3b8" value={newFirstName} onChangeText={setNewFirstName} />
                                                </View>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.fieldLabel}>New Surname</Text>
                                                <View style={styles.fieldInputBox}>
                                                    <TextInput style={styles.fieldTextInput} placeholder="Surname" placeholderTextColor="#94a3b8" value={newSurname} onChangeText={setNewSurname} />
                                                </View>
                                            </View>
                                        </View>

                                        <Text style={styles.fieldLabel}>New Middle Name (Optional)</Text>
                                        <View style={styles.fieldInputBox}>
                                            <TextInput style={styles.fieldTextInput} placeholder="Middle name" placeholderTextColor="#94a3b8" value={newMiddleName} onChangeText={setNewMiddleName} />
                                        </View>
                                    </>
                                )}

                                {/* TAB 2: Change of Phone Number */}
                                {selectedServiceId === 'nin_mod_phone' && (
                                    <>
                                        <Text style={styles.fieldLabel}>Current Full Name on NIN</Text>
                                        <View style={styles.fieldInputBox}>
                                            <Ionicons name="person-outline" size={16} color="#94a3b8" style={{ marginRight: 6 }} />
                                            <TextInput 
                                                style={styles.fieldTextInput} 
                                                placeholder="First Last" 
                                                placeholderTextColor="#94a3b8" 
                                                value={currentFullName} 
                                                onChangeText={setCurrentFullName} 
                                            />
                                        </View>

                                        <Text style={styles.fieldLabel}>New Phone Number to Link</Text>
                                        <View style={styles.fieldInputBox}>
                                            <Ionicons name="phone-portrait-outline" size={16} color="#94a3b8" style={{ marginRight: 6 }} />
                                            <TextInput 
                                                style={styles.fieldTextInput} 
                                                placeholder="08012345678" 
                                                placeholderTextColor="#94a3b8" 
                                                keyboardType="number-pad"
                                                maxLength={11}
                                                value={newPhoneToLink} 
                                                onChangeText={setNewPhoneToLink} 
                                            />
                                        </View>
                                    </>
                                )}

                                {/* TAB 3: Change of Address */}
                                {selectedServiceId === 'nin_mod_address' && (
                                    <>
                                        <View style={{ flexDirection: 'row', gap: 8 }}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.fieldLabel}>Current Full Name</Text>
                                                <View style={styles.fieldInputBox}>
                                                    <TextInput style={styles.fieldTextInput} placeholder="First Last" placeholderTextColor="#94a3b8" value={currentFullName} onChangeText={setCurrentFullName} />
                                                </View>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.fieldLabel}>Current Phone Number</Text>
                                                <View style={styles.fieldInputBox}>
                                                    <TextInput style={styles.fieldTextInput} placeholder="08012345678" placeholderTextColor="#94a3b8" keyboardType="number-pad" maxLength={11} value={currentPhone} onChangeText={setCurrentPhone} />
                                                </View>
                                            </View>
                                        </View>

                                        <Text style={styles.fieldLabel}>New Address</Text>
                                        <View style={[styles.fieldInputBox, { height: 58, alignItems: 'flex-start', paddingTop: 8 }]}>
                                            <TextInput style={[styles.fieldTextInput, { textAlignVertical: 'top' }]} placeholder="Full new residential address" placeholderTextColor="#94a3b8" multiline numberOfLines={2} value={newAddress} onChangeText={setNewAddress} />
                                        </View>
                                    </>
                                )}

                                {/* Modern Fee Container */}
                                <View style={styles.feeCardBox}>
                                    <View>
                                        <Text style={{ color: '#334155', fontWeight: '700', fontSize: 11 }}>Modification Fee</Text>
                                        <Text style={{ color: '#64748b', fontSize: 9.5, fontWeight: '500' }}>⚡ Fast-Track Admin Review (12-24h)</Text>
                                    </View>
                                    <Text style={{ color: '#d97706', fontWeight: '800', fontSize: 18 }}>₦{(activeService.fee || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                                </View>

                                {/* Primary Submit Button */}
                                <TouchableOpacity 
                                    onPress={handleFormSubmit}
                                    disabled={loading}
                                    style={styles.submitBtn}
                                    activeOpacity={0.85}
                                >
                                    {loading ? <ActivityIndicator color="#f5a623" size="small" /> : (
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Ionicons name="send" size={15} color="#f5a623" style={{ marginRight: 6 }} />
                                            <Text style={styles.submitBtnText}>Submit Modification Request</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            </View>

                            {/* Track Your Status Card */}
                            <View style={styles.sideInfoCard}>
                                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                                    <View style={styles.trackIconCircle}>
                                        <Ionicons name="time-outline" size={18} color="#f5a623" />
                                    </View>
                                    <View style={{ marginLeft: 10, flex: 1 }}>
                                        <Text style={{ color: '#0f172a', fontWeight: '800', fontSize: 13 }}>Track Your Status</Text>
                                        <Text style={{ color: '#64748b', fontSize: 10.5, fontWeight: '500', marginTop: 2, lineHeight: 15 }}>
                                            Modifications are processed by our admin team manually. Please check your history log to track progress and view feedback.
                                        </Text>
                                        
                                        <TouchableOpacity 
                                            onPress={() => router.push('/nin-services/history')} 
                                            style={styles.viewHistoryBtn}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={styles.viewHistoryBtnText}>View History</Text>
                                            <Ionicons name="arrow-forward" size={13} color="#060d21" style={{ marginLeft: 3 }} />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>

                            {/* Important Reminder Card */}
                            <View style={styles.reminderCard}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                                    <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
                                    <Text style={{ color: '#ef4444', fontWeight: '800', fontSize: 12, marginLeft: 5 }}>Important Reminder</Text>
                                </View>
                                <Text style={{ color: '#475569', fontSize: 10.5, fontWeight: '500', lineHeight: 15, marginBottom: 3 }}>
                                    • Ensure you have legal authorization before submitting records on behalf of others.
                                </Text>
                                <Text style={{ color: '#475569', fontSize: 10.5, fontWeight: '500', lineHeight: 15 }}>
                                    • If your request fails due to an invalid submission, You will have to resubmit the application.
                                </Text>
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
    navHeaderBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(245, 166, 35, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(245, 166, 35, 0.3)',
    },
    stepProgressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 12,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.08)',
    },
    stepItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    stepDot: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 4,
    },
    stepDotActive: {
        backgroundColor: '#f5a623',
    },
    stepDotNum: {
        color: '#060d21',
        fontWeight: '900',
        fontSize: 9.5,
    },
    stepText: {
        color: '#94a3b8',
        fontSize: 10,
        fontWeight: '600',
    },
    stepTextActive: {
        color: '#ffffff',
        fontWeight: '700',
    },
    stepLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        marginHorizontal: 6,
    },
    stepLineActive: {
        flex: 1,
        height: 1,
        backgroundColor: '#f5a623',
        marginHorizontal: 6,
    },
    termsBannerBox: {
        backgroundColor: '#fffbeb',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#fde68a',
        paddingVertical: 8,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    selectorTab: {
        flex: 1,
        backgroundColor: '#ffffff',
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 6,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        alignItems: 'center',
        justify: 'center',
        flexDirection: 'row',
    },
    selectorTabActive: {
        borderColor: '#060d21',
        backgroundColor: '#060d21',
    },
    selectorTabText: {
        color: '#475569',
        fontWeight: '600',
        fontSize: 10.5,
    },
    selectorTabTextActive: {
        color: '#f5a623',
        fontWeight: '800',
    },
    mainFormCard: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 12,
        shadowColor: '#64748b',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },
    fieldLabel: {
        color: '#475569',
        fontWeight: '700',
        fontSize: 11,
        marginBottom: 4,
        marginTop: 6,
    },
    fieldInputBox: {
        backgroundColor: '#ffffff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        height: 40,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
    },
    fieldTextInput: {
        flex: 1,
        color: '#0f172a',
        fontWeight: '600',
        fontSize: 12,
    },
    pasteTag: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 4,
    },
    pasteTagText: {
        color: '#475569',
        fontWeight: '700',
        fontSize: 8.5,
    },
    feeCardBox: {
        backgroundColor: '#fffbeb',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#fde68a',
        paddingVertical: 10,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justify: 'space-between',
        marginTop: 12,
        marginBottom: 12,
    },
    submitBtn: {
        backgroundColor: '#060d21',
        height: 44,
        borderRadius: 10,
        alignItems: 'center',
        justify: 'center',
        shadowColor: '#060d21',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
    },
    submitBtnText: {
        color: '#f5a623',
        fontWeight: '800',
        fontSize: 13,
    },
    sideInfoCard: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 10,
    },
    trackIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#060d21',
        alignItems: 'center',
        justify: 'center',
    },
    viewHistoryBtn: {
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        paddingVertical: 6,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justify: 'center',
        alignSelf: 'flex-start',
        marginTop: 8,
    },
    viewHistoryBtnText: {
        color: '#060d21',
        fontWeight: '700',
        fontSize: 11,
    },
    reminderCard: {
        backgroundColor: '#fef2f2',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: '#fecaca',
        marginBottom: 16,
    },

    // Ultra-Clean Compact Navy & Gold Terms Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(6, 13, 33, 0.8)',
        alignItems: 'center',
        justify: 'center',
        padding: 14,
    },
    termsModalCard: {
        backgroundColor: '#ffffff',
        borderRadius: 18,
        width: '100%',
        maxWidth: 460,
        maxHeight: '82%',
        overflow: 'hidden',
        shadowColor: '#060d21',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
        borderWidth: 1,
        borderColor: 'rgba(245, 166, 35, 0.25)',
    },
    termsHeaderGradient: {
        paddingVertical: 14,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(245, 166, 35, 0.15)',
    },
    warningIconBg: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(245, 166, 35, 0.12)',
        alignItems: 'center',
        justify: 'center',
        borderWidth: 1,
        borderColor: 'rgba(245, 166, 35, 0.3)',
    },
    termsTitle: {
        color: '#ffffff',
        fontWeight: '800',
        fontSize: 15,
        letterSpacing: 0.1,
    },
    termsSubtitle: {
        color: '#f5a623',
        fontSize: 10.5,
        fontWeight: '600',
        marginTop: 1,
    },
    closeModalBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justify: 'center',
    },
    termsScroll: {
        flex: 1,
    },
    termSectionCard: {
        flexDirection: 'row',
        marginBottom: 10,
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    termNumBadge: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#060d21',
        alignItems: 'center',
        justify: 'center',
        marginTop: 1,
    },
    termNumBadgeText: {
        color: '#f5a623',
        fontWeight: '800',
        fontSize: 10,
    },
    termHeading: {
        color: '#060d21',
        fontWeight: '800',
        fontSize: 11.5,
        marginBottom: 2,
    },
    termBody: {
        color: '#475569',
        fontSize: 10.5,
        fontWeight: '500',
        lineHeight: 15.5,
    },
    highlightTermBox: {
        backgroundColor: '#fffbeb',
        borderRadius: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: '#fde68a',
        marginBottom: 10,
    },
    termsFooterBox: {
        padding: 12,
        backgroundColor: '#ffffff',
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    termsAgreeBtn: {
        borderRadius: 10,
        overflow: 'hidden',
        shadowColor: '#d97706',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 3,
    },
    termsAgreeBtnGradient: {
        height: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 14,
    },
    termsAgreeBtnText: {
        color: '#ffffff',
        fontWeight: '800',
        fontSize: 12,
        textAlign: 'center',
    },

    // Custom Alert Modal Styles
    alertCard: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 20,
        width: '100%',
        maxWidth: 320,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 14,
        elevation: 8,
    },
    alertIconCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justify: 'center',
        marginBottom: 12,
    },
    alertTitle: {
        color: '#060d21',
        fontWeight: '800',
        fontSize: 15,
        textAlign: 'center',
        marginBottom: 6,
    },
    alertMessage: {
        color: '#64748b',
        fontSize: 12,
        fontWeight: '500',
        textAlign: 'center',
        lineHeight: 16,
        marginBottom: 16,
    },
    alertButton: {
        backgroundColor: '#060d21',
        height: 40,
        borderRadius: 10,
        width: '100%',
        alignItems: 'center',
        justify: 'center',
    },
    alertButtonText: {
        color: '#f5a623',
        fontWeight: '800',
        fontSize: 13,
    },
});
