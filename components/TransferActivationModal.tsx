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

    // Form Fields - Section 1: Account Type & Category
    const [accountCategory, setAccountCategory] = useState<'Individual' | 'Corporate'>('Individual');
    const [fullName, setFullName] = useState(initialName);
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState(initialEmail);
    const [bvn, setBvn] = useState('');

    // Section 2: Occupation & Financial Profile
    const [occupation, setOccupation] = useState('');
    const [employerBusinessName, setEmployerBusinessName] = useState('');
    const [cacNumber, setCacNumber] = useState('');
    const [purpose, setPurpose] = useState('Personal Support & Everyday Utilities');
    const [monthlyVolume, setMonthlyVolume] = useState('₦100,000 - ₦500,000');
    const [averageAmount, setAverageAmount] = useState('₦10,000 - ₦50,000');
    const [dailyFrequency, setDailyFrequency] = useState('1 - 5 transfers/day');
    const [sourceOfFunds, setSourceOfFunds] = useState('Salary / Personal Earnings');
    const [originatingBank, setOriginatingBank] = useState('');

    // Section 3: Settlement Bank & Beneficiary Validation
    const [destinationBank, setDestinationBank] = useState('');
    const [destinationAccountNumber, setDestinationAccountNumber] = useState('');
    const [destinationAccountName, setDestinationAccountName] = useState('');

    // Section 4: Residential & Geographical Address
    const [address, setAddress] = useState('');
    const [city, setCity] = useState('');
    const [stateName, setStateName] = useState('');
    const [landmark, setLandmark] = useState('');

    // Section 5: Next of Kin
    const [nextOfKinName, setNextOfKinName] = useState('');
    const [nextOfKinRelationship, setNextOfKinRelationship] = useState('Sibling');
    const [nextOfKinPhone, setNextOfKinPhone] = useState('');
    const [nextOfKinAddress, setNextOfKinAddress] = useState('');

    // Section 6: Government Identification & Security
    const [idType, setIdType] = useState('NIN (National Identity Number)');
    const [idNumber, setIdNumber] = useState('');
    const [securitySecretWord, setSecuritySecretWord] = useState('');
    const [notPepConfirmed, setNotPepConfirmed] = useState(true);
    const [amlAgreed, setAmlAgreed] = useState(true);

    const handleSubmit = async () => {
        // Validation
        if (!fullName.trim() || !phone.trim() || !occupation.trim() || !employerBusinessName.trim() ||
            !address.trim() || !city.trim() || !stateName.trim() || !nextOfKinName.trim() ||
            !nextOfKinPhone.trim() || !idNumber.trim()) {
            Alert.alert('Required Information Missing', 'Please fill out all required fields marked with an asterisk (*) to complete your Transfer Activation application.');
            return;
        }

        if (bvn.trim() && bvn.trim().length !== 11) {
            Alert.alert('Invalid BVN', 'If provided, Bank Verification Number (BVN) must be exactly 11 digits.');
            return;
        }

        if (!amlAgreed) {
            Alert.alert('Compliance Agreement Required', 'You must agree to the AML/CFT financial compliance declaration to proceed.');
            return;
        }

        setSubmitting(true);
        try {
            const basePayload = {
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
                originating_bank: originatingBank.trim() || 'Commercial Bank',
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
            };

            const fullPayload = {
                ...basePayload,
                account_category: accountCategory,
                bvn: bvn.trim() || null,
                destination_bank: destinationBank.trim() || null,
                destination_account_number: destinationAccountNumber.trim() || null,
                destination_account_name: destinationAccountName.trim() || null,
                daily_transfer_frequency: dailyFrequency,
                next_of_kin_address: nextOfKinAddress.trim() || null,
                security_secret_word: securitySecretWord.trim() || null,
                pep_declared: !notPepConfirmed,
            };

            // 1. Insert into transfer_activation_requests with graceful fallback
            let { error: reqError } = await supabase
                .from('transfer_activation_requests')
                .insert(fullPayload);

            if (reqError && reqError.message && (reqError.message.includes('column') || reqError.code === '42703')) {
                const retry = await supabase
                    .from('transfer_activation_requests')
                    .insert(basePayload);
                reqError = retry.error;
            }

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
                    {/* NAVY & GOLD LUXURY EXECUTIVE HEADER */}
                    <LinearGradient
                        colors={['#070D1E', '#0D1B3E', '#162447']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={s.headerGradient}
                    >
                        <View style={s.headerInner}>
                            <View style={s.goldShieldBox}>
                                <Ionicons name="shield-checkmark" size={18} color="#FFD700" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                    <Text style={s.headerTitle}>Transfer Activation Application</Text>
                                    <View style={s.goldBadge}>
                                        <Text style={s.goldBadgeText}>TIER 3 COMPLIANCE</Text>
                                    </View>
                                </View>
                                <Text style={s.headerSubtitle}>
                                    Abu Mafhal Ltd &bull; RC-8979939
                                </Text>
                            </View>
                            <TouchableOpacity onPress={onClose} style={s.closeBtn} activeOpacity={0.7}>
                                <Ionicons name="close" size={18} color="#FFD700" />
                            </TouchableOpacity>
                        </View>
                    </LinearGradient>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
                        {/* NOTICE BANNER - NAVY & GOLD LUXURY */}
                        <View style={s.noticeBanner}>
                            <View style={s.noticeIconBox}>
                                <Ionicons name="lock-closed" size={14} color="#D97706" />
                            </View>
                            <Text style={s.noticeText}>
                                In accordance with anti-fraud guidelines, fund transfers require audited verification. Once approved by Admin, a 24-hour mandatory security cooldown will apply.
                            </Text>
                        </View>

                        {/* SECTION 1: ACCOUNT TYPE & PERSONAL */}
                        <View style={s.sectionHeaderRow}>
                            <View style={s.sectionIconBox}>
                                <Ionicons name="person" size={13} color="#D97706" />
                            </View>
                            <Text style={s.sectionTitle}>1. Account Category & Identity</Text>
                        </View>

                        <Text style={s.label}>Account Operating Category *</Text>
                        <View style={s.chipGroup}>
                            <TouchableOpacity
                                onPress={() => setAccountCategory('Individual')}
                                style={[s.chip, accountCategory === 'Individual' && s.chipActive]}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name="person-outline"
                                    size={12}
                                    color={accountCategory === 'Individual' ? '#F5A623' : '#64748B'}
                                    style={{ marginRight: 5 }}
                                />
                                <Text style={[s.chipText, accountCategory === 'Individual' && s.chipTextActive]}>
                                    Personal / Individual
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setAccountCategory('Corporate')}
                                style={[s.chip, accountCategory === 'Corporate' && s.chipActive]}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name="business-outline"
                                    size={12}
                                    color={accountCategory === 'Corporate' ? '#F5A623' : '#64748B'}
                                    style={{ marginRight: 5 }}
                                />
                                <Text style={[s.chipText, accountCategory === 'Corporate' && s.chipTextActive]}>
                                    Business / Corporate
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={s.label}>Full Legal Name *</Text>
                        <TextInput
                            style={s.input}
                            value={fullName}
                            onChangeText={setFullName}
                            placeholder="e.g. Sale Abu Mafhal"
                            placeholderTextColor="#94A3B8"
                        />

                        <View style={s.row}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={s.label}>Phone Number *</Text>
                                <TextInput
                                    style={s.input}
                                    value={phone}
                                    onChangeText={setPhone}
                                    placeholder="e.g. 08145853539"
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
                                    placeholder="e.g. user@example.com"
                                    placeholderTextColor="#94A3B8"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />
                            </View>
                        </View>

                        <Text style={s.label}>Bank Verification Number (BVN)</Text>
                        <TextInput
                            style={s.input}
                            value={bvn}
                            onChangeText={setBvn}
                            placeholder="11-digit BVN (Optional for extra trust)"
                            placeholderTextColor="#94A3B8"
                            keyboardType="number-pad"
                            maxLength={11}
                        />

                        {/* SECTION 2: OCCUPATION, BUSINESS & SOURCE OF FUNDS */}
                        <View style={s.sectionHeaderRow}>
                            <View style={s.sectionIconBox}>
                                <Ionicons name="briefcase" size={13} color="#D97706" />
                            </View>
                            <Text style={s.sectionTitle}>2. Occupation & Financial Profile</Text>
                        </View>

                        <Text style={s.label}>Occupation / Nature of Work *</Text>
                        <TextInput
                            style={s.input}
                            value={occupation}
                            onChangeText={setOccupation}
                            placeholder="e.g. Civil Servant, Trader, Software Engineer"
                            placeholderTextColor="#94A3B8"
                        />

                        <Text style={s.label}>Employer / Registered Business Name *</Text>
                        <TextInput
                            style={s.input}
                            value={employerBusinessName}
                            onChangeText={setEmployerBusinessName}
                            placeholder="e.g. Ministry, Institution or Business Name"
                            placeholderTextColor="#94A3B8"
                        />

                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                            <Text style={s.label}>CAC Registration Number (RC / BN)</Text>
                            <View style={s.optionalBadge}>
                                <Text style={s.optionalBadgeText}>CAC / OPTIONAL</Text>
                            </View>
                        </View>
                        <TextInput
                            style={s.input}
                            value={cacNumber}
                            onChangeText={setCacNumber}
                            placeholder="e.g. RC-8979939 or BN-1234567"
                            placeholderTextColor="#94A3B8"
                            autoCapitalize="characters"
                        />

                        <Text style={s.label}>Primary Purpose of Outgoing Transfers *</Text>
                        <TextInput
                            style={s.input}
                            value={purpose}
                            onChangeText={setPurpose}
                            placeholder="e.g. Vendor payments, family support, utilities"
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

                        <Text style={s.label}>Expected Daily Transfer Frequency</Text>
                        <View style={s.chipGroup}>
                            {['1 - 5 transfers/day', '6 - 20 transfers/day', '20+ transfers/day'].map((freq) => (
                                <TouchableOpacity
                                    key={freq}
                                    onPress={() => setDailyFrequency(freq)}
                                    style={[s.chip, dailyFrequency === freq && s.chipActive]}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[s.chipText, dailyFrequency === freq && s.chipTextActive]}>
                                        {freq}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={s.label}>Primary Source of Funds *</Text>
                        <TextInput
                            style={s.input}
                            value={sourceOfFunds}
                            onChangeText={setSourceOfFunds}
                            placeholder="e.g. Salary, Business Trading, Investments"
                            placeholderTextColor="#94A3B8"
                        />

                        <Text style={s.label}>Primary Originating Bank / Institution</Text>
                        <TextInput
                            style={s.input}
                            value={originatingBank}
                            onChangeText={setOriginatingBank}
                            placeholder="e.g. GTBank, Zenith Bank, OPay, Moniepoint"
                            placeholderTextColor="#94A3B8"
                        />

                        {/* SECTION 3: DESTINATION / SETTLEMENT ACCOUNT */}
                        <View style={s.sectionHeaderRow}>
                            <View style={s.sectionIconBox}>
                                <Ionicons name="card" size={13} color="#D97706" />
                            </View>
                            <Text style={s.sectionTitle}>3. Destination Settlement Account</Text>
                        </View>

                        <Text style={s.label}>Primary Destination Bank Name</Text>
                        <TextInput
                            style={s.input}
                            value={destinationBank}
                            onChangeText={setDestinationBank}
                            placeholder="e.g. Access Bank, First Bank, PalmPay"
                            placeholderTextColor="#94A3B8"
                        />

                        <View style={s.row}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={s.label}>Account Number (NUBAN)</Text>
                                <TextInput
                                    style={s.input}
                                    value={destinationAccountNumber}
                                    onChangeText={setDestinationAccountNumber}
                                    placeholder="10-digit NUBAN"
                                    placeholderTextColor="#94A3B8"
                                    keyboardType="number-pad"
                                    maxLength={10}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.label}>Account Name Verification</Text>
                                <TextInput
                                    style={s.input}
                                    value={destinationAccountName}
                                    onChangeText={setDestinationAccountName}
                                    placeholder="e.g. SALE ABU MAFHAL"
                                    placeholderTextColor="#94A3B8"
                                />
                            </View>
                        </View>

                        {/* SECTION 4: RESIDENTIAL ADDRESS */}
                        <View style={s.sectionHeaderRow}>
                            <View style={s.sectionIconBox}>
                                <Ionicons name="home" size={13} color="#D97706" />
                            </View>
                            <Text style={s.sectionTitle}>4. Residential Physical Address</Text>
                        </View>

                        <Text style={s.label}>Street Address *</Text>
                        <TextInput
                            style={s.input}
                            value={address}
                            onChangeText={setAddress}
                            placeholder="e.g. Plot 124, Zoo Road"
                            placeholderTextColor="#94A3B8"
                        />

                        <View style={s.row}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={s.label}>City / Town *</Text>
                                <TextInput
                                    style={s.input}
                                    value={city}
                                    onChangeText={setCity}
                                    placeholder="e.g. Kano"
                                    placeholderTextColor="#94A3B8"
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.label}>State *</Text>
                                <TextInput
                                    style={s.input}
                                    value={stateName}
                                    onChangeText={setStateName}
                                    placeholder="e.g. Kano State"
                                    placeholderTextColor="#94A3B8"
                                />
                            </View>
                        </View>

                        <Text style={s.label}>Nearest Landmark</Text>
                        <TextInput
                            style={s.input}
                            value={landmark}
                            onChangeText={setLandmark}
                            placeholder="e.g. Opposite Central Mosque / Plaza"
                            placeholderTextColor="#94A3B8"
                        />

                        {/* SECTION 5: NEXT OF KIN & EMERGENCY */}
                        <View style={s.sectionHeaderRow}>
                            <View style={s.sectionIconBox}>
                                <Ionicons name="people" size={13} color="#D97706" />
                            </View>
                            <Text style={s.sectionTitle}>5. Emergency Contact / Next of Kin</Text>
                        </View>

                        <Text style={s.label}>Next of Kin Full Legal Name *</Text>
                        <TextInput
                            style={s.input}
                            value={nextOfKinName}
                            onChangeText={setNextOfKinName}
                            placeholder="Full legal name of next of kin"
                            placeholderTextColor="#94A3B8"
                        />

                        <View style={s.row}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={s.label}>Relationship *</Text>
                                <TextInput
                                    style={s.input}
                                    value={nextOfKinRelationship}
                                    onChangeText={setNextOfKinRelationship}
                                    placeholder="e.g. Brother, Spouse, Parent"
                                    placeholderTextColor="#94A3B8"
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.label}>Phone Number *</Text>
                                <TextInput
                                    style={s.input}
                                    value={nextOfKinPhone}
                                    onChangeText={setNextOfKinPhone}
                                    placeholder="e.g. 08012345678"
                                    placeholderTextColor="#94A3B8"
                                    keyboardType="phone-pad"
                                />
                            </View>
                        </View>

                        <Text style={s.label}>Next of Kin Address (City / State)</Text>
                        <TextInput
                            style={s.input}
                            value={nextOfKinAddress}
                            onChangeText={setNextOfKinAddress}
                            placeholder="e.g. Kano, Kano State"
                            placeholderTextColor="#94A3B8"
                        />

                        {/* SECTION 6: GOVERNMENT ID & SECURITY */}
                        <View style={s.sectionHeaderRow}>
                            <View style={s.sectionIconBox}>
                                <Ionicons name="finger-print" size={13} color="#D97706" />
                            </View>
                            <Text style={s.sectionTitle}>6. Government ID &amp; Security</Text>
                        </View>

                        <Text style={s.label}>ID Document Type *</Text>
                        <View style={s.chipGroup}>
                            {['NIN', 'BVN', "Voter's Card", "Driver's License", 'Passport'].map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    onPress={() => setIdType(type)}
                                    style={[s.chip, idType === type && s.chipActive]}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[s.chipText, idType === type && s.chipTextActive]}>
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
                            placeholder="Enter document identification number"
                            placeholderTextColor="#94A3B8"
                        />

                        <Text style={s.label}>Security Verification Word / Secret Passphrase</Text>
                        <TextInput
                            style={s.input}
                            value={securitySecretWord}
                            onChangeText={setSecuritySecretWord}
                            placeholder="Single secret word for phone audit challenge"
                            placeholderTextColor="#94A3B8"
                            secureTextEntry={false}
                            autoCapitalize="none"
                        />

                        {/* PEP DECLARATION */}
                        <TouchableOpacity
                            onPress={() => setNotPepConfirmed(!notPepConfirmed)}
                            style={s.checkboxRow}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name={notPepConfirmed ? 'checkbox' : 'square-outline'}
                                size={17}
                                color={notPepConfirmed ? '#D97706' : '#94A3B8'}
                            />
                            <Text style={s.checkboxText}>
                                I confirm that I am <strong>NOT</strong> a Politically Exposed Person (PEP), nor an immediate family member or close associate of a senior government official.
                            </Text>
                        </TouchableOpacity>

                        {/* AML / LEGAL DECLARATION */}
                        <TouchableOpacity
                            onPress={() => setAmlAgreed(!amlAgreed)}
                            style={s.checkboxRow}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name={amlAgreed ? 'checkbox' : 'square-outline'}
                                size={17}
                                color={amlAgreed ? '#D97706' : '#94A3B8'}
                            />
                            <Text style={s.checkboxText}>
                                I declare that all supplied data is genuine. I confirm that all wallet transfers are funded from legitimate activities and comply strictly with Nigerian AML/CFT regulations.
                            </Text>
                        </TouchableOpacity>

                        {/* 24-HOUR COOLDOWN NOTICE */}
                        <View style={s.cooldownNotice}>
                            <Ionicons name="timer-outline" size={16} color="#0D1B3E" style={{ marginRight: 8 }} />
                            <Text style={s.cooldownNoticeText}>
                                Mandatory 24h Lock: Upon approval by Compliance Admin, transfer features unlock exactly 24 hours later to protect user funds from unauthorized account switches.
                            </Text>
                        </View>

                        {/* SUBMIT BUTTON - LUXURY NAVY & GOLD */}
                        <TouchableOpacity
                            onPress={handleSubmit}
                            disabled={submitting}
                            style={s.submitBtn}
                            activeOpacity={0.88}
                        >
                            <LinearGradient
                                colors={['#D97706', '#F5A623', '#D97706']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={s.submitGradient}
                            >
                                {submitting ? (
                                    <ActivityIndicator color="#0D1B3E" size="small" />
                                ) : (
                                    <>
                                        <Ionicons name="shield-checkmark" size={15} color="#0D1B3E" style={{ marginRight: 6 }} />
                                        <Text style={s.submitBtnText}>SUBMIT ACTIVATION APPLICATION</Text>
                                    </>
                                )}
                            </LinearGradient>
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
        backgroundColor: 'rgba(7, 13, 30, 0.65)',
        justifyContent: 'flex-end',
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '94%',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#070D1E',
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.15,
        shadowRadius: 14,
        elevation: 12,
        overflow: 'hidden',
    },
    headerGradient: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderBottomWidth: 2,
        borderBottomColor: '#F5A623',
    },
    headerInner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 14,
    },
    goldShieldBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 215, 0, 0.18)',
        borderWidth: 1.5,
        borderColor: '#F5A623',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: 13.5,
        fontWeight: '900',
        letterSpacing: -0.2,
    },
    goldBadge: {
        backgroundColor: 'rgba(245, 166, 35, 0.2)',
        paddingHorizontal: 6,
        paddingVertical: 1.5,
        borderRadius: 4,
        borderWidth: 0.8,
        borderColor: '#F5A623',
    },
    goldBadgeText: {
        color: '#FFD700',
        fontSize: 7.5,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    headerSubtitle: {
        color: '#F5A623',
        fontSize: 10,
        fontWeight: '700',
        marginTop: 2,
    },
    closeBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(245, 166, 35, 0.4)',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: Platform.OS === 'ios' ? 40 : 28,
        backgroundColor: '#FFFFFF',
    },
    noticeBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFBEB',
        borderWidth: 1,
        borderColor: '#FDE68A',
        borderRadius: 10,
        padding: 10,
        marginBottom: 14,
    },
    noticeIconBox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        backgroundColor: '#FEF3C7',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    noticeText: {
        flex: 1,
        color: '#92400E',
        fontSize: 10.5,
        lineHeight: 15,
        fontWeight: '600',
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        marginBottom: 8,
        paddingBottom: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    sectionIconBox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        backgroundColor: '#FEF3C7',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 7,
    },
    sectionTitle: {
        color: '#0D1B3E',
        fontSize: 11.5,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    label: {
        color: '#1E293B',
        fontSize: 10.5,
        fontWeight: '700',
        marginBottom: 3.5,
    },
    optionalBadge: {
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 5,
        paddingVertical: 1.5,
        borderRadius: 4,
        borderWidth: 0.8,
        borderColor: '#A7F3D0',
    },
    optionalBadgeText: {
        color: '#059669',
        fontSize: 7.5,
        fontWeight: '900',
    },
    input: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 8,
        paddingHorizontal: 11,
        paddingVertical: 7,
        color: '#070D1E',
        fontSize: 11,
        marginBottom: 9,
        fontWeight: '600',
    },
    row: {
        flexDirection: 'row',
    },
    chipGroup: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 10,
    },
    chip: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 7,
        paddingHorizontal: 10,
        paddingVertical: 5.5,
        flexDirection: 'row',
        alignItems: 'center',
    },
    chipActive: {
        backgroundColor: '#0D1B3E',
        borderColor: '#F5A623',
    },
    chipText: {
        color: '#475569',
        fontSize: 10,
        fontWeight: '700',
    },
    chipTextActive: {
        color: '#FFD700',
        fontWeight: '900',
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: 6,
        marginBottom: 10,
        gap: 8,
    },
    checkboxText: {
        flex: 1,
        color: '#475569',
        fontSize: 10,
        lineHeight: 14.5,
        fontWeight: '500',
    },
    cooldownNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0F9FF',
        borderWidth: 1,
        borderColor: '#BAE6FD',
        borderRadius: 9,
        padding: 9,
        marginTop: 6,
        marginBottom: 16,
    },
    cooldownNoticeText: {
        flex: 1,
        color: '#0369A1',
        fontSize: 10,
        lineHeight: 14.5,
        fontWeight: '600',
    },
    submitBtn: {
        borderRadius: 9,
        overflow: 'hidden',
        marginBottom: 8,
        shadowColor: '#D97706',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 4,
    },
    submitGradient: {
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    submitBtnText: {
        color: '#070D1E',
        fontSize: 11.5,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
});
