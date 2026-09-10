import React, { useState } from 'react';
import {
    View,
    Text,
    Modal,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { supabase } from '../services/supabase';

interface TransferActivationModalProps {
    visible: boolean;
    userId: string;
    initialName?: string;
    initialEmail?: string;
    onClose: () => void;
    onSubmitted: () => void;
}

export default function TransferActivationModal({
    visible,
    userId,
    initialName = '',
    initialEmail = '',
    onClose,
    onSubmitted,
}: TransferActivationModalProps) {
    const [submitting, setSubmitting] = useState(false);

    // Form Fields
    const [fullName, setFullName] = useState(initialName);
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState(initialEmail);
    const [occupation, setOccupation] = useState('');
    const [employerBusinessName, setEmployerBusinessName] = useState('');
    const [cacNumber, setCacNumber] = useState('');
    const [purpose, setPurpose] = useState('Family Support & Personal Expenses');
    const [monthlyVolume, setMonthlyVolume] = useState('₦100,000 - ₦500,000');
    const [averageAmount, setAverageAmount] = useState('₦10,000 - ₦50,000');
    const [sourceOfFunds, setSourceOfFunds] = useState('Salary / Personal Earnings');
    const [originatingBank, setOriginatingBank] = useState('');
    const [address, setAddress] = useState('');
    const [city, setCity] = useState('');
    const [stateName, setStateName] = useState('');
    const [landmark, setLandmark] = useState('');
    const [nextOfKinName, setNextOfKinName] = useState('');
    const [nextOfKinRelationship, setNextOfKinRelationship] = useState('Sibling');
    const [nextOfKinPhone, setNextOfKinPhone] = useState('');
    const [idType, setIdType] = useState('NIN (National Identity Number)');
    const [idNumber, setIdNumber] = useState('');
    const [amlAgreed, setAmlAgreed] = useState(true);

    const handleSubmit = async () => {
        // Validation
        if (!fullName.trim() || !phone.trim() || !occupation.trim() || !employerBusinessName.trim() ||
            !address.trim() || !city.trim() || !stateName.trim() || !nextOfKinName.trim() ||
            !nextOfKinPhone.trim() || !idNumber.trim()) {
            Alert.alert('Required Information Missing', 'Please fill out all required fields marked with an asterisk (*) to complete your Transfer Activation application.');
            return;
        }

        if (!amlAgreed) {
            Alert.alert('Compliance Agreement Required', 'You must agree to the AML/CFT financial compliance declaration to proceed.');
            return;
        }

        setSubmitting(true);
        try {
            // 1. Insert into transfer_activation_requests (including cac_number)
            const { error: reqError } = await supabase
                .from('transfer_activation_requests')
                .insert({
                    user_id: userId,
                    full_name: fullName.trim(),
                    phone: phone.trim(),
                    email: email.trim(),
                    occupation: occupation.trim(),
                    employer_business_name: employerBusinessName.trim(),
                    cac_number: cacNumber.trim() || null,
                    purpose: purpose.trim(),
                    estimated_monthly_volume: monthlyVolume.trim(),
                    average_transfer_amount: averageAmount.trim(),
                    source_of_funds: sourceOfFunds.trim(),
                    originating_bank: originatingBank.trim() || 'Nigerian Commercial Bank',
                    residential_address: address.trim(),
                    city: city.trim(),
                    state: stateName.trim(),
                    nearest_landmark: landmark.trim() || null,
                    next_of_kin_name: nextOfKinName.trim(),
                    next_of_kin_relationship: nextOfKinRelationship.trim(),
                    next_of_kin_phone: nextOfKinPhone.trim(),
                    id_type: idType.trim(),
                    id_number: idNumber.trim(),
                    aml_agreement: true,
                    status: 'pending',
                });

            if (reqError) {
                console.error('transfer activation insert error:', reqError);
                throw reqError;
            }

            // 2. Update user profile transfer_status = 'pending'
            await supabase
                .from('profiles')
                .update({
                    transfer_status: 'pending',
                    transfer_approved: false,
                })
                .eq('id', userId);

            if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }

            Alert.alert(
                'Application Submitted! 🛡️',
                'Your Transfer Activation Request has been submitted successfully to the Compliance Team. Admin will review your application. Once approved, a 24-hour mandatory security cooldown will begin before transfers unlock.',
                [{ text: 'Understood', onPress: onSubmitted }]
            );
        } catch (err: any) {
            Alert.alert('Submission Error', err.message || 'Unable to submit application. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={s.backdrop}
            >
                <View style={s.card}>
                    {/* Modern Executive Header */}
                    <View style={s.header}>
                        <View style={s.iconBox}>
                            <Ionicons name="shield-checkmark" size={20} color="#D97706" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={s.title}>Transfer Activation Application</Text>
                            <Text style={s.subtitle}>Tier 3 Compliance & Security Verification</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={s.closeBtn} activeOpacity={0.7}>
                            <Ionicons name="close" size={20} color="#64748B" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
                        {/* Notice Banner */}
                        <View style={s.noticeBanner}>
                            <Ionicons name="shield-checkmark-outline" size={17} color="#D97706" style={{ marginRight: 8 }} />
                            <Text style={s.noticeText}>
                                In compliance with anti-fraud regulations, fund transfer privileges require compliance review. Please provide accurate details.
                            </Text>
                        </View>

                        {/* SECTION 1: PERSONAL & CONTACT */}
                        <Text style={s.sectionTitle}>1. Personal & Contact Information</Text>

                        <Text style={s.label}>Full Legal Name *</Text>
                        <TextInput
                            style={s.input}
                            value={fullName}
                            onChangeText={setFullName}
                            placeholder="Full legal name"
                            placeholderTextColor="#94A3B8"
                        />

                        <View style={s.row}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={s.label}>Phone Number *</Text>
                                <TextInput
                                    style={s.input}
                                    value={phone}
                                    onChangeText={setPhone}
                                    placeholder="08012345678"
                                    placeholderTextColor="#94A3B8"
                                    keyboardType="phone-pad"
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.label}>Email Address</Text>
                                <TextInput
                                    style={s.input}
                                    value={email}
                                    onChangeText={setEmail}
                                    placeholder="user@example.com"
                                    placeholderTextColor="#94A3B8"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />
                            </View>
                        </View>

                        {/* SECTION 2: OCCUPATION & SOURCE OF FUNDS */}
                        <Text style={s.sectionTitle}>2. Occupation & Financial Profile</Text>

                        <Text style={s.label}>Occupation / Nature of Business *</Text>
                        <TextInput
                            style={s.input}
                            value={occupation}
                            onChangeText={setOccupation}
                            placeholder="e.g. Civil Servant, Trader, Engineer"
                            placeholderTextColor="#94A3B8"
                        />

                        <Text style={s.label}>Employer / Registered Business Name *</Text>
                        <TextInput
                            style={s.input}
                            value={employerBusinessName}
                            onChangeText={setEmployerBusinessName}
                            placeholder="e.g. Enterprise or Ministry Name"
                            placeholderTextColor="#94A3B8"
                        />

                        {/* CAC REGISTRATION NUMBER FIELD */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                            <Text style={s.label}>CAC Registration Number (RC / BN)</Text>
                            <View style={s.corporateBadge}>
                                <Text style={s.corporateBadgeText}>BUSINESS / OPTIONAL</Text>
                            </View>
                        </View>
                        <TextInput
                            style={s.input}
                            value={cacNumber}
                            onChangeText={setCacNumber}
                            placeholder="e.g. RC-1849203 or BN-938201"
                            placeholderTextColor="#94A3B8"
                            autoCapitalize="characters"
                        />

                        <Text style={s.label}>Primary Purpose of Outgoing Transfers *</Text>
                        <TextInput
                            style={s.input}
                            value={purpose}
                            onChangeText={setPurpose}
                            placeholder="e.g. Personal expenses, vendor payments"
                            placeholderTextColor="#94A3B8"
                        />

                        <View style={s.row}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={s.label}>Monthly Volume *</Text>
                                <TextInput
                                    style={s.input}
                                    value={monthlyVolume}
                                    onChangeText={setMonthlyVolume}
                                    placeholder="e.g. ₦100,000 - ₦500,000"
                                    placeholderTextColor="#94A3B8"
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.label}>Average per Transfer *</Text>
                                <TextInput
                                    style={s.input}
                                    value={averageAmount}
                                    onChangeText={setAverageAmount}
                                    placeholder="e.g. ₦10,000 - ₦50,000"
                                    placeholderTextColor="#94A3B8"
                                />
                            </View>
                        </View>

                        <Text style={s.label}>Primary Source of Funds *</Text>
                        <TextInput
                            style={s.input}
                            value={sourceOfFunds}
                            onChangeText={setSourceOfFunds}
                            placeholder="e.g. Salary, Business earnings"
                            placeholderTextColor="#94A3B8"
                        />

                        <Text style={s.label}>Primary Originating Bank / Institution</Text>
                        <TextInput
                            style={s.input}
                            value={originatingBank}
                            onChangeText={setOriginatingBank}
                            placeholder="e.g. GTBank, Zenith, OPay"
                            placeholderTextColor="#94A3B8"
                        />

                        {/* SECTION 3: RESIDENTIAL ADDRESS */}
                        <Text style={s.sectionTitle}>3. Residential Address</Text>

                        <Text style={s.label}>Full Street Address *</Text>
                        <TextInput
                            style={s.input}
                            value={address}
                            onChangeText={setAddress}
                            placeholder="Residential street address"
                            placeholderTextColor="#94A3B8"
                        />

                        <View style={s.row}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={s.label}>City / Town *</Text>
                                <TextInput
                                    style={s.input}
                                    value={city}
                                    onChangeText={setCity}
                                    placeholder="City or Town"
                                    placeholderTextColor="#94A3B8"
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.label}>State *</Text>
                                <TextInput
                                    style={s.input}
                                    value={stateName}
                                    onChangeText={setStateName}
                                    placeholder="State"
                                    placeholderTextColor="#94A3B8"
                                />
                            </View>
                        </View>

                        <Text style={s.label}>Nearest Landmark</Text>
                        <TextInput
                            style={s.input}
                            value={landmark}
                            onChangeText={setLandmark}
                            placeholder="Nearest landmark (optional)"
                            placeholderTextColor="#94A3B8"
                        />

                        {/* SECTION 4: NEXT OF KIN */}
                        <Text style={s.sectionTitle}>4. Emergency Contact / Next of Kin</Text>

                        <Text style={s.label}>Next of Kin Full Name *</Text>
                        <TextInput
                            style={s.input}
                            value={nextOfKinName}
                            onChangeText={setNextOfKinName}
                            placeholder="Full legal name"
                            placeholderTextColor="#94A3B8"
                        />

                        <View style={s.row}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={s.label}>Relationship *</Text>
                                <TextInput
                                    style={s.input}
                                    value={nextOfKinRelationship}
                                    onChangeText={setNextOfKinRelationship}
                                    placeholder="e.g. Sibling, Spouse"
                                    placeholderTextColor="#94A3B8"
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.label}>Phone Number *</Text>
                                <TextInput
                                    style={s.input}
                                    value={nextOfKinPhone}
                                    onChangeText={setNextOfKinPhone}
                                    placeholder="08012345678"
                                    placeholderTextColor="#94A3B8"
                                    keyboardType="phone-pad"
                                />
                            </View>
                        </View>

                        {/* SECTION 5: IDENTIFICATION */}
                        <Text style={s.sectionTitle}>5. Government Identification</Text>

                        <Text style={s.label}>ID Document Type *</Text>
                        <View style={s.idTypeRow}>
                            {['NIN', 'BVN', "Voter's Card", "Driver's License"].map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    onPress={() => setIdType(type)}
                                    style={[s.idTypeChip, idType === type && s.idTypeChipActive]}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[s.idTypeChipText, idType === type && s.idTypeChipTextActive]}>
                                        {type}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={s.label}>Document / Identification Number *</Text>
                        <TextInput
                            style={s.input}
                            value={idNumber}
                            onChangeText={setIdNumber}
                            placeholder="ID or document number"
                            placeholderTextColor="#94A3B8"
                        />

                        {/* SECTION 6: LEGAL DECLARATION */}
                        <TouchableOpacity
                            onPress={() => setAmlAgreed(!amlAgreed)}
                            style={s.checkboxRow}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name={amlAgreed ? 'checkbox' : 'square-outline'}
                                size={18}
                                color={amlAgreed ? '#D97706' : '#94A3B8'}
                            />
                            <Text style={s.checkboxText}>
                                I hereby declare that all provided details are true and accurate. I confirm that all funds processed through this account originate from lawful activities and strictly comply with Anti-Money Laundering (AML/CFT) regulations.
                            </Text>
                        </TouchableOpacity>

                        {/* 24-HOUR MATURATION NOTICE */}
                        <View style={s.cooldownNotice}>
                            <Ionicons name="time-outline" size={17} color="#2563EB" style={{ marginRight: 8 }} />
                            <Text style={s.cooldownNoticeText}>
                                Mandatory 24h Cooldown: Once approved by Compliance Admin, fund transfers remain locked for exactly 24 hours to prevent unauthorized account takeovers.
                            </Text>
                        </View>

                        {/* SUBMIT BUTTON */}
                        <TouchableOpacity
                            onPress={handleSubmit}
                            disabled={submitting}
                            style={s.submitBtn}
                            activeOpacity={0.85}
                        >
                            {submitting ? (
                                <ActivityIndicator color="#FFFFFF" size="small" />
                            ) : (
                                <>
                                    <Ionicons name="shield-checkmark" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                                    <Text style={s.submitBtnText}>SUBMIT ACTIVATION APPLICATION</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const s = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        justifyContent: 'flex-end',
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        maxHeight: '92%',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 18,
        paddingTop: 16,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
    },
    iconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#FDE68A',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    title: {
        color: '#0F172A',
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: -0.2,
    },
    subtitle: {
        color: '#64748B',
        fontSize: 10.5,
        marginTop: 1,
    },
    closeBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrollContent: {
        padding: 18,
        paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    },
    noticeBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFBEB',
        borderWidth: 1,
        borderColor: '#FDE68A',
        borderRadius: 10,
        padding: 10,
        marginBottom: 16,
    },
    noticeText: {
        flex: 1,
        color: '#92400E',
        fontSize: 11,
        lineHeight: 16,
        fontWeight: '600',
    },
    sectionTitle: {
        color: '#D97706',
        fontSize: 12,
        fontWeight: '900',
        marginTop: 12,
        marginBottom: 10,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    label: {
        color: '#334155',
        fontSize: 11,
        fontWeight: '700',
        marginBottom: 4,
    },
    corporateBadge: {
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 0.8,
        borderColor: '#A7F3D0',
    },
    corporateBadgeText: {
        color: '#059669',
        fontSize: 8,
        fontWeight: '900',
    },
    input: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 8,
        paddingHorizontal: 11,
        paddingVertical: 7.5,
        color: '#0F172A',
        fontSize: 11.5,
        marginBottom: 10,
        fontWeight: '500',
    },
    row: {
        flexDirection: 'row',
    },
    idTypeRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 10,
    },
    idTypeChip: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 7,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    idTypeChipActive: {
        backgroundColor: '#FEF3C7',
        borderColor: '#F59E0B',
    },
    idTypeChipText: {
        color: '#475569',
        fontSize: 10.5,
        fontWeight: '700',
    },
    idTypeChipTextActive: {
        color: '#B45309',
        fontWeight: '900',
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: 8,
        marginBottom: 14,
        gap: 8,
    },
    checkboxText: {
        flex: 1,
        color: '#64748B',
        fontSize: 10.5,
        lineHeight: 15,
        fontWeight: '500',
    },
    cooldownNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EFF6FF',
        borderWidth: 1,
        borderColor: '#BFDBFE',
        borderRadius: 10,
        padding: 10,
        marginBottom: 18,
    },
    cooldownNoticeText: {
        flex: 1,
        color: '#1E40AF',
        fontSize: 10.5,
        lineHeight: 15,
        fontWeight: '600',
    },
    submitBtn: {
        backgroundColor: '#D97706',
        borderRadius: 10,
        paddingVertical: 13,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#D97706',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 4,
        marginBottom: 10,
    },
    submitBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 0.4,
    },
});
