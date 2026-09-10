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
            Alert.alert('Required Information Missing', 'Please fill out all required fields to complete your Transfer Activation application.');
            return;
        }

        if (!amlAgreed) {
            Alert.alert('Compliance Agreement Required', 'You must agree to the AML/CFT financial compliance declaration to proceed.');
            return;
        }

        setSubmitting(true);
        try {
            // 1. Insert into transfer_activation_requests
            const { error: reqError } = await supabase
                .from('transfer_activation_requests')
                .insert({
                    user_id: userId,
                    full_name: fullName.trim(),
                    phone: phone.trim(),
                    email: email.trim(),
                    occupation: occupation.trim(),
                    employer_business_name: employerBusinessName.trim(),
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
                    {/* Header */}
                    <View style={s.header}>
                        <View style={s.iconBox}>
                            <Ionicons name="shield-checkmark" size={22} color="#F59E0B" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={s.title}>Transfer Activation Application</Text>
                            <Text style={s.subtitle}>Tier 3 Compliance & Security Vetting Form</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={s.closeBtn}>
                            <Ionicons name="close" size={20} color="#94A3B8" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
                        {/* Notice Banner */}
                        <View style={s.noticeBanner}>
                            <Ionicons name="information-circle" size={18} color="#F59E0B" style={{ marginRight: 8 }} />
                            <Text style={s.noticeText}>
                                In compliance with anti-fraud regulations, transfer privileges require manual administrator approval. Please provide accurate details.
                            </Text>
                        </View>

                        {/* SECTION 1: PERSONAL & CONTACT */}
                        <Text style={s.sectionTitle}>1. Personal & Contact Information</Text>

                        <Text style={s.label}>Full Legal Name *</Text>
                        <TextInput
                            style={s.input}
                            value={fullName}
                            onChangeText={setFullName}
                            placeholder="Enter full legal name"
                            placeholderTextColor="#64748B"
                        />

                        <View style={s.row}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={s.label}>Phone Number *</Text>
                                <TextInput
                                    style={s.input}
                                    value={phone}
                                    onChangeText={setPhone}
                                    placeholder="08012345678"
                                    placeholderTextColor="#64748B"
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
                                    placeholderTextColor="#64748B"
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
                            placeholder="e.g. Civil Servant, Trader, Software Engineer"
                            placeholderTextColor="#64748B"
                        />

                        <Text style={s.label}>Employer / Registered Business Name *</Text>
                        <TextInput
                            style={s.input}
                            value={employerBusinessName}
                            onChangeText={setEmployerBusinessName}
                            placeholder="e.g. Federal Ministry / Self-Employed Enterprise"
                            placeholderTextColor="#64748B"
                        />

                        <Text style={s.label}>Primary Purpose of Outgoing Transfers *</Text>
                        <TextInput
                            style={s.input}
                            value={purpose}
                            onChangeText={setPurpose}
                            placeholder="e.g. Family support, vendor settlement, utility payments"
                            placeholderTextColor="#64748B"
                        />

                        <View style={s.row}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={s.label}>Monthly Volume *</Text>
                                <TextInput
                                    style={s.input}
                                    value={monthlyVolume}
                                    onChangeText={setMonthlyVolume}
                                    placeholder="e.g. ₦100,000 - ₦500,000"
                                    placeholderTextColor="#64748B"
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.label}>Average per Transfer *</Text>
                                <TextInput
                                    style={s.input}
                                    value={averageAmount}
                                    onChangeText={setAverageAmount}
                                    placeholder="e.g. ₦10,000 - ₦50,000"
                                    placeholderTextColor="#64748B"
                                />
                            </View>
                        </View>

                        <Text style={s.label}>Primary Source of Funds *</Text>
                        <TextInput
                            style={s.input}
                            value={sourceOfFunds}
                            onChangeText={setSourceOfFunds}
                            placeholder="e.g. Monthly Salary, Business Revenue, Savings"
                            placeholderTextColor="#64748B"
                        />

                        <Text style={s.label}>Primary Bank / Originating Funding Institution</Text>
                        <TextInput
                            style={s.input}
                            value={originatingBank}
                            onChangeText={setOriginatingBank}
                            placeholder="e.g. GTBank, Zenith Bank, OPay, Moniepoint"
                            placeholderTextColor="#64748B"
                        />

                        {/* SECTION 3: RESIDENTIAL ADDRESS */}
                        <Text style={s.sectionTitle}>3. Residential Address</Text>

                        <Text style={s.label}>Full Street Address *</Text>
                        <TextInput
                            style={s.input}
                            value={address}
                            onChangeText={setAddress}
                            placeholder="Street number, building name and street"
                            placeholderTextColor="#64748B"
                        />

                        <View style={s.row}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={s.label}>City / Town *</Text>
                                <TextInput
                                    style={s.input}
                                    value={city}
                                    onChangeText={setCity}
                                    placeholder="e.g. Ikeja, Kano, Abuja"
                                    placeholderTextColor="#64748B"
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.label}>State *</Text>
                                <TextInput
                                    style={s.input}
                                    value={stateName}
                                    onChangeText={setStateName}
                                    placeholder="e.g. Lagos, Kano, FCT"
                                    placeholderTextColor="#64748B"
                                />
                            </View>
                        </View>

                        <Text style={s.label}>Nearest Landmark</Text>
                        <TextInput
                            style={s.input}
                            value={landmark}
                            onChangeText={setLandmark}
                            placeholder="e.g. Near Central Mosque / General Hospital"
                            placeholderTextColor="#64748B"
                        />

                        {/* SECTION 4: NEXT OF KIN */}
                        <Text style={s.sectionTitle}>4. Emergency Contact / Next of Kin</Text>

                        <Text style={s.label}>Next of Kin Full Name *</Text>
                        <TextInput
                            style={s.input}
                            value={nextOfKinName}
                            onChangeText={setNextOfKinName}
                            placeholder="Full name of next of kin"
                            placeholderTextColor="#64748B"
                        />

                        <View style={s.row}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={s.label}>Relationship *</Text>
                                <TextInput
                                    style={s.input}
                                    value={nextOfKinRelationship}
                                    onChangeText={setNextOfKinRelationship}
                                    placeholder="e.g. Spouse, Sibling, Parent"
                                    placeholderTextColor="#64748B"
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.label}>Phone Number *</Text>
                                <TextInput
                                    style={s.input}
                                    value={nextOfKinPhone}
                                    onChangeText={setNextOfKinPhone}
                                    placeholder="08012345678"
                                    placeholderTextColor="#64748B"
                                    keyboardType="phone-pad"
                                />
                            </View>
                        </View>

                        {/* SECTION 5: IDENTIFICATION */}
                        <Text style={s.sectionTitle}>5. Official Identity Verification</Text>

                        <Text style={s.label}>Government ID Document Type *</Text>
                        <TextInput
                            style={s.input}
                            value={idType}
                            onChangeText={setIdType}
                            placeholder="e.g. NIN, Voter's Card, Driver's License, Passport"
                            placeholderTextColor="#64748B"
                        />

                        <Text style={s.label}>ID Document Number *</Text>
                        <TextInput
                            style={s.input}
                            value={idNumber}
                            onChangeText={setIdNumber}
                            placeholder="Enter corresponding document number"
                            placeholderTextColor="#64748B"
                        />

                        {/* AML AGREEMENT */}
                        <TouchableOpacity
                            style={s.checkboxRow}
                            onPress={() => setAmlAgreed(!amlAgreed)}
                            activeOpacity={0.8}
                        >
                            <Ionicons
                                name={amlAgreed ? "checkbox" : "square-outline"}
                                size={22}
                                color={amlAgreed ? "#F59E0B" : "#64748B"}
                            />
                            <Text style={s.checkboxText}>
                                I certify under penalty of perjury that all information provided is true and accurate. I pledge that all outgoing funds are legitimate and in full compliance with Nigerian AML/CFT and financial regulations.
                            </Text>
                        </TouchableOpacity>

                        {/* Cooldown Warning Notice */}
                        <View style={s.cooldownNotice}>
                            <Ionicons name="time-outline" size={16} color="#3B82F6" style={{ marginRight: 6 }} />
                            <Text style={s.cooldownNoticeText}>
                                Note: Upon Administrator Approval, a mandatory 24-hour security maturation cooldown is enforced before transfers become active.
                            </Text>
                        </View>

                        {/* Submit Button */}
                        <TouchableOpacity
                            style={[s.submitBtn, submitting && { opacity: 0.6 }]}
                            onPress={handleSubmit}
                            disabled={submitting}
                            activeOpacity={0.85}
                        >
                            {submitting ? (
                                <ActivityIndicator color="#020617" />
                            ) : (
                                <>
                                    <Ionicons name="paper-plane" size={16} color="#020617" style={{ marginRight: 8 }} />
                                    <Text style={s.submitBtnText}>SUBMIT APPLICATION FOR REVIEW</Text>
                                </>
                            )}
                        </TouchableOpacity>

                        <View style={{ height: 24 }} />
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const s = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(2, 6, 23, 0.85)',
        justifyContent: 'flex-end',
    },
    card: {
        backgroundColor: '#0F172A',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '92%',
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 18,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#1E293B',
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '800',
    },
    subtitle: {
        color: '#94A3B8',
        fontSize: 12,
        marginTop: 2,
    },
    closeBtn: {
        padding: 6,
    },
    scrollContent: {
        padding: 20,
    },
    noticeBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.25)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 20,
    },
    noticeText: {
        flex: 1,
        color: '#FDE68A',
        fontSize: 12,
        lineHeight: 17,
    },
    sectionTitle: {
        color: '#F59E0B',
        fontSize: 14,
        fontWeight: '800',
        marginTop: 14,
        marginBottom: 12,
        letterSpacing: 0.3,
    },
    label: {
        color: '#E2E8F0',
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 6,
    },
    input: {
        backgroundColor: '#020617',
        borderWidth: 1,
        borderColor: '#334155',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: '#FFFFFF',
        fontSize: 13,
        marginBottom: 12,
    },
    row: {
        flexDirection: 'row',
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: 12,
        marginBottom: 16,
        gap: 10,
    },
    checkboxText: {
        flex: 1,
        color: '#94A3B8',
        fontSize: 11.5,
        lineHeight: 16,
    },
    cooldownNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.25)',
        borderRadius: 10,
        padding: 10,
        marginBottom: 20,
    },
    cooldownNoticeText: {
        flex: 1,
        color: '#93C5FD',
        fontSize: 11.5,
        lineHeight: 16,
    },
    submitBtn: {
        backgroundColor: '#F59E0B',
        borderRadius: 12,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    submitBtnText: {
        color: '#020617',
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
});
