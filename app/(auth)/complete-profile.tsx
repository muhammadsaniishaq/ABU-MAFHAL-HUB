import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator,
    StyleSheet,
    Modal,
    Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { supabase, forceSignOut } from '../../services/supabase';

const NIGERIAN_STATES = [
    'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
    'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT - Abuja', 'Gombe',
    'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos',
    'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto',
    'Taraba', 'Yobe', 'Zamfara'
];

function validateNigerianPhone(phone: string): { isValid: boolean; formatted: string; error?: string } {
    const cleaned = (phone || '').replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('0')) {
        return { isValid: true, formatted: cleaned };
    }
    if (cleaned.length === 10 && !cleaned.startsWith('0')) {
        return { isValid: true, formatted: '0' + cleaned };
    }
    if (cleaned.startsWith('234') && cleaned.length === 13) {
        return { isValid: true, formatted: '0' + cleaned.slice(3) };
    }
    return { isValid: false, formatted: cleaned, error: 'Please enter a valid 11-digit phone number (e.g. 08012345678).' };
}

export default function CompleteProfileScreen() {
    const router = useRouter();

    const [userId, setUserId] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string>('');
    const [fullName, setFullName] = useState<string>('');
    const [username, setUsername] = useState<string>('');
    const [phone, setPhone] = useState<string>('');
    const [whatsappNumber, setWhatsappNumber] = useState<string>('');
    const [sameAsPhone, setSameAsPhone] = useState<boolean>(true);
    const [selectedState, setSelectedState] = useState<string>('Kano');
    const [showStateModal, setShowStateModal] = useState<boolean>(false);
    const [stateSearch, setStateSearch] = useState<string>('');

    // Loading & Action states
    const [initialLoading, setInitialLoading] = useState<boolean>(true);
    const [submitting, setSubmitting] = useState<boolean>(false);

    useEffect(() => {
        loadUserProfile();
    }, []);

    const loadUserProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.replace('/(auth)/login' as any);
                return;
            }

            setUserId(user.id);
            setUserEmail(user.email || '');

            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name, username, phone, whatsapp_number, state')
                .eq('id', user.id)
                .maybeSingle();

            if (profile) {
                if (profile.full_name) setFullName(profile.full_name);
                else if (user.user_metadata?.full_name) setFullName(user.user_metadata.full_name);
                else if (user.user_metadata?.name) setFullName(user.user_metadata.name);

                if (profile.username) {
                    setUsername(profile.username);
                } else if (user.email) {
                    const fallbackUser = user.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                    setUsername(fallbackUser);
                }

                if (profile.phone) {
                    setPhone(profile.phone);
                    setWhatsappNumber(profile.whatsapp_number || profile.phone);
                }
                if (profile.whatsapp_number && profile.phone && profile.whatsapp_number !== profile.phone) {
                    setSameAsPhone(false);
                    setWhatsappNumber(profile.whatsapp_number);
                }
                if (profile.state) setSelectedState(profile.state);
            }
        } catch (e) {
            console.error('Error loading profile in CompleteProfile:', e);
        } finally {
            setInitialLoading(false);
        }
    };

    const handlePhoneChange = (text: string) => {
        const cleaned = text.replace(/\D/g, '').slice(0, 11);
        setPhone(cleaned);
        if (sameAsPhone) {
            setWhatsappNumber(cleaned);
        }
    };

    const handleWhatsappChange = (text: string) => {
        const cleaned = text.replace(/\D/g, '').slice(0, 11);
        setWhatsappNumber(cleaned);
    };

    const toggleSameAsPhone = (val: boolean) => {
        setSameAsPhone(val);
        if (val) {
            setWhatsappNumber(phone);
        }
    };

    // Save Profile with Strict Database Duplicate Checks
    const handleSaveProfile = async () => {
        if (!userId) {
            Alert.alert('Session Error', 'Please log in again.');
            router.replace('/(auth)/login' as any);
            return;
        }

        // 1. Full Name Validation
        if (!fullName.trim() || fullName.trim().length < 3) {
            Alert.alert('Full Name Required', 'Please enter your genuine full name (min 3 characters).');
            return;
        }

        // 2. Username Validation
        const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
        if (!cleanUsername || cleanUsername.length < 3) {
            Alert.alert('Username Required', 'Please choose a valid username (min 3 characters, letters and numbers only).');
            return;
        }

        // 3. Phone Number Format Validation
        const phoneVal = validateNigerianPhone(phone);
        if (!phoneVal.isValid) {
            Alert.alert('Invalid Phone Number', phoneVal.error || 'Please enter an 11-digit Nigerian phone number.');
            return;
        }

        const effectiveWhatsapp = sameAsPhone ? phoneVal.formatted : whatsappNumber.trim();
        if (!sameAsPhone && effectiveWhatsapp) {
            const waVal = validateNigerianPhone(effectiveWhatsapp);
            if (!waVal.isValid) {
                Alert.alert('Invalid WhatsApp Number', 'Please enter a valid 11-digit WhatsApp phone number.');
                return;
            }
        }

        setSubmitting(true);
        try {
            // 🛡️ 4. DATABASE CHECK: PREVENT DUPLICATE PHONE NUMBERS (Strict anti-double check)
            const cleanDigits10 = phoneVal.formatted.slice(-10);
            const { data: duplicatePhoneUsers, error: phoneCheckErr } = await supabase
                .from('profiles')
                .select('id, full_name, phone')
                .ilike('phone', `%${cleanDigits10}`)
                .neq('id', userId)
                .limit(1);

            if (phoneCheckErr) {
                console.warn('Phone uniqueness pre-check notice:', phoneCheckErr);
            }

            if (duplicatePhoneUsers && duplicatePhoneUsers.length > 0) {
                Alert.alert(
                    'Phone Number Already Registered 🔒',
                    'This phone number is already registered to another account in our system. Duplicate phone numbers are strictly prohibited. Please provide your personal phone number.'
                );
                setSubmitting(false);
                return;
            }

            // Also check WhatsApp number uniqueness if entered separately
            if (!sameAsPhone && effectiveWhatsapp) {
                const waDigits10 = effectiveWhatsapp.slice(-10);
                const { data: duplicateWaUsers } = await supabase
                    .from('profiles')
                    .select('id, full_name, phone')
                    .or(`phone.ilike.%${waDigits10},whatsapp_number.ilike.%${waDigits10}`)
                    .neq('id', userId)
                    .limit(1);

                if (duplicateWaUsers && duplicateWaUsers.length > 0) {
                    Alert.alert(
                        'WhatsApp Number In Use 🔒',
                        'This WhatsApp number is already linked to another account. Please use your unique personal number.'
                    );
                    setSubmitting(false);
                    return;
                }
            }

            // 🛡️ 5. DATABASE CHECK: PREVENT DUPLICATE USERNAME
            const { data: duplicateUsernames, error: usernameCheckErr } = await supabase
                .from('profiles')
                .select('id, username')
                .ilike('username', cleanUsername)
                .neq('id', userId)
                .limit(1);

            if (usernameCheckErr) {
                console.warn('Username uniqueness pre-check notice:', usernameCheckErr);
            }

            if (duplicateUsernames && duplicateUsernames.length > 0) {
                Alert.alert(
                    'Username Already Taken 🔒',
                    'This username is already taken by another user. Please choose a different username.'
                );
                setSubmitting(false);
                return;
            }

            // 6. Direct Database Update (Profiles)
            const updatePayload: Record<string, any> = {
                full_name: fullName.trim(),
                username: cleanUsername,
                phone: phoneVal.formatted,
                whatsapp_number: effectiveWhatsapp || phoneVal.formatted,
                state: selectedState,
                phone_verified: true,
                whatsapp_verified: true,
                status: 'active',
                updated_at: new Date().toISOString()
            };

            const { error: profileUpdateError } = await supabase
                .from('profiles')
                .update(updatePayload)
                .eq('id', userId);

            if (profileUpdateError) {
                throw new Error(profileUpdateError.message || 'Failed to update profile record.');
            }

            // 7. Background Auto Virtual Account Generation
            try {
                supabase.functions.invoke('create-virtual-account', {
                    body: { userId: userId }
                }).catch(() => {});
            } catch (_) {}

            if (Platform.OS !== 'web') {
                try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (_) {}
            }

            const successNotice = 'Profile details saved successfully! Please set your 4-digit transaction PIN to secure your wallet.';
            if (Platform.OS === 'web') {
                alert(successNotice);
                router.replace('/(auth)/pin-setup' as any);
            } else {
                Alert.alert('Profile Complete 🎉', successNotice, [
                    {
                        text: 'Set Transaction PIN',
                        onPress: () => router.replace('/(auth)/pin-setup' as any)
                    }
                ]);
            }
        } catch (err: any) {
            Alert.alert('Update Failed ❌', err.message || 'Unable to update profile. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSignOut = async () => {
        await forceSignOut();
        router.replace('/(auth)/login' as any);
    };

    const filteredStates = NIGERIAN_STATES.filter(st =>
        st.toLowerCase().includes(stateSearch.toLowerCase().trim())
    );

    if (initialLoading) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#D4AF37" />
                <Text style={styles.loadingText}>Loading profile details...</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Top Security Step Badge */}
                    <View style={styles.stepBadgeRow}>
                        <View style={styles.stepBadge}>
                            <Ionicons name="shield-checkmark" size={13} color="#B45309" />
                            <Text style={styles.stepBadgeText}>STEP 2 OF 2 • SECURE ONBOARDING</Text>
                        </View>
                    </View>

                    {/* Executive Modern Light Header */}
                    <View style={styles.header}>
                        <LinearGradient
                            colors={['#0A1128', '#111D3B']}
                            style={styles.logoBadge}
                        >
                            <FontAwesome5 name="user-check" size={18} color="#D4AF37" />
                        </LinearGradient>
                        <Text style={styles.title}>Complete Your Profile</Text>
                        <Text style={styles.subtitle}>
                            Provide your genuine contact information to activate automated VTU services, virtual accounts, and 24/7 transaction alerts.
                        </Text>
                    </View>

                    {/* Clean White Card */}
                    <View style={styles.card}>
                        {/* Email (Read Only - Authenticated) */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.microLabel}>AUTHENTICATED EMAIL</Text>
                            <View style={[styles.inputBox, styles.readOnlyBox]}>
                                <Ionicons name="mail" size={16} color="#64748B" style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, styles.readOnlyText]}
                                    value={userEmail}
                                    editable={false}
                                />
                                <Ionicons name="lock-closed" size={15} color="#94A3B8" />
                            </View>
                        </View>

                        {/* Full Name */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.microLabel}>
                                FULL NAME <Text style={styles.required}>*</Text>
                            </Text>
                            <View style={styles.inputBox}>
                                <Ionicons name="person-outline" size={17} color="#D4AF37" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. Muhammad Sani Isyaku"
                                    placeholderTextColor="#94A3B8"
                                    value={fullName}
                                    onChangeText={setFullName}
                                    autoCapitalize="words"
                                />
                            </View>
                        </View>

                        {/* Username */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.microLabel}>
                                UNIQUE USERNAME <Text style={styles.required}>*</Text>
                            </Text>
                            <View style={styles.inputBox}>
                                <Ionicons name="at" size={17} color="#D4AF37" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. sani_hub"
                                    placeholderTextColor="#94A3B8"
                                    value={username}
                                    onChangeText={t => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                    autoCapitalize="none"
                                />
                            </View>
                        </View>

                        {/* Phone Number with Nigerian Flag */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.microLabel}>
                                PHONE NUMBER <Text style={styles.required}>*</Text>
                            </Text>
                            <View style={styles.inputBox}>
                                <View style={styles.countryPrefix}>
                                    <Text style={styles.flag}>🇳🇬</Text>
                                    <Text style={styles.countryCode}>+234</Text>
                                </View>
                                <TextInput
                                    style={styles.input}
                                    placeholder="08012345678"
                                    placeholderTextColor="#94A3B8"
                                    value={phone}
                                    onChangeText={handlePhoneChange}
                                    keyboardType="phone-pad"
                                    maxLength={11}
                                />
                            </View>
                            <Text style={styles.helperText}>Each account must have a unique personal phone number.</Text>
                        </View>

                        {/* WhatsApp Number Switch */}
                        <View style={styles.switchCard}>
                            <View style={styles.switchLeft}>
                                <View style={styles.whatsappIconCircle}>
                                    <Ionicons name="logo-whatsapp" size={16} color="#16A34A" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.switchTitle}>Same WhatsApp Number</Text>
                                    <Text style={styles.switchSubtitle}>Use your phone number for official notifications</Text>
                                </View>
                            </View>
                            <Switch
                                value={sameAsPhone}
                                onValueChange={toggleSameAsPhone}
                                trackColor={{ false: '#CBD5E1', true: '#10B981' }}
                                thumbColor={sameAsPhone ? '#FFFFFF' : '#F1F5F9'}
                            />
                        </View>

                        {/* Separate WhatsApp Input (Only when toggled off) */}
                        {!sameAsPhone && (
                            <View style={styles.inputGroup}>
                                <Text style={styles.microLabel}>
                                    WHATSAPP NUMBER <Text style={styles.required}>*</Text>
                                </Text>
                                <View style={styles.inputBox}>
                                    <View style={styles.countryPrefix}>
                                        <Ionicons name="logo-whatsapp" size={15} color="#16A34A" style={{ marginRight: 4 }} />
                                        <Text style={styles.countryCode}>+234</Text>
                                    </View>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="08012345678"
                                        placeholderTextColor="#94A3B8"
                                        value={whatsappNumber}
                                        onChangeText={handleWhatsappChange}
                                        keyboardType="phone-pad"
                                        maxLength={11}
                                    />
                                </View>
                            </View>
                        )}

                        {/* State Selection */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.microLabel}>STATE OF RESIDENCE</Text>
                            <TouchableOpacity
                                style={[styles.inputBox, styles.selectBox]}
                                onPress={() => {
                                    setStateSearch('');
                                    setShowStateModal(true);
                                }}
                                activeOpacity={0.8}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                    <Ionicons name="location-outline" size={17} color="#D4AF37" style={styles.inputIcon} />
                                    <Text style={styles.selectText}>{selectedState}</Text>
                                </View>
                                <Ionicons name="chevron-down" size={16} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        {/* Primary Action Button (No WhatsApp OTP gating) */}
                        <View style={styles.actionContainer}>
                            <TouchableOpacity
                                style={[styles.primaryButton, submitting && styles.disabledButton]}
                                onPress={handleSaveProfile}
                                disabled={submitting}
                                activeOpacity={0.85}
                            >
                                <LinearGradient
                                    colors={['#0A1128', '#111D3B']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.buttonGradient}
                                >
                                    {submitting ? (
                                        <ActivityIndicator color="#FFFFFF" size="small" />
                                    ) : (
                                        <View style={styles.btnContentRow}>
                                            <Text style={styles.primaryButtonText}>Complete Profile & Proceed</Text>
                                            <Ionicons name="arrow-forward" size={17} color="#D4AF37" style={{ marginLeft: 8 }} />
                                        </View>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={styles.logoutButton}
                            onPress={handleSignOut}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.logoutText}>Switch Account or Sign Out</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* State Picker Modal (Clean Light Theme) */}
            <Modal
                visible={showStateModal}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setShowStateModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.stateModalContent}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Ionicons name="map-outline" size={18} color="#D4AF37" />
                                <Text style={styles.modalTitle}>Select State</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowStateModal(false)} style={styles.modalCloseBtn}>
                                <Ionicons name="close" size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        {/* Search Bar */}
                        <View style={styles.searchBar}>
                            <Ionicons name="search" size={16} color="#64748B" style={{ marginRight: 8 }} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search Nigerian state..."
                                placeholderTextColor="#94A3B8"
                                value={stateSearch}
                                onChangeText={setStateSearch}
                                autoCapitalize="none"
                            />
                            {stateSearch.length > 0 && (
                                <TouchableOpacity onPress={() => setStateSearch('')}>
                                    <Ionicons name="close-circle" size={16} color="#94A3B8" />
                                </TouchableOpacity>
                            )}
                        </View>

                        <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
                            {filteredStates.map((st) => {
                                const isSelected = selectedState === st;
                                return (
                                    <TouchableOpacity
                                        key={st}
                                        style={[styles.stateItem, isSelected && styles.selectedStateItem]}
                                        onPress={() => {
                                            setSelectedState(st);
                                            setShowStateModal(false);
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[styles.stateItemText, isSelected && styles.selectedStateItemText]}>
                                            {st}
                                        </Text>
                                        {isSelected && (
                                            <Ionicons name="checkmark-circle" size={18} color="#D4AF37" />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                            {filteredStates.length === 0 && (
                                <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                                    <Text style={{ color: '#64748B', fontSize: 13 }}>No states matching "{stateSearch}"</Text>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 14,
        color: '#64748B',
        fontSize: 14,
        fontWeight: '600',
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 36,
        alignSelf: 'center',
        width: '100%',
        maxWidth: 440,
    },
    stepBadgeRow: {
        alignItems: 'center',
        marginBottom: 10,
    },
    stepBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#FEF3C7',
        borderColor: '#FDE68A',
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
    },
    stepBadgeText: {
        color: '#B45309',
        fontSize: 10.5,
        fontWeight: '800',
        letterSpacing: 0.8,
    },
    header: {
        alignItems: 'center',
        marginBottom: 16,
    },
    logoBadge: {
        width: 46,
        height: 46,
        borderRadius: 23,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
        elevation: 4,
        shadowColor: '#0A1128',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
    },
    title: {
        fontSize: 22,
        fontWeight: '900',
        color: '#071435',
        textAlign: 'center',
        letterSpacing: -0.3,
    },
    subtitle: {
        fontSize: 12.5,
        color: '#64748B',
        textAlign: 'center',
        marginTop: 5,
        lineHeight: 18,
        paddingHorizontal: 12,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        paddingHorizontal: 18,
        paddingVertical: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#071435',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 3,
    },
    inputGroup: {
        marginBottom: 14,
    },
    microLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: '#475569',
        marginBottom: 6,
        letterSpacing: 0.5,
    },
    required: {
        color: '#EF4444',
    },
    inputBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderWidth: 1.2,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 48,
    },
    readOnlyBox: {
        backgroundColor: '#F1F5F9',
        borderColor: '#E2E8F0',
    },
    inputIcon: {
        marginRight: 8,
    },
    input: {
        flex: 1,
        color: '#071435',
        fontSize: 14,
        fontWeight: '600',
    },
    readOnlyText: {
        color: '#64748B',
        fontWeight: '500',
    },
    countryPrefix: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 8,
        borderRightWidth: 1,
        borderRightColor: '#E2E8F0',
        paddingRight: 8,
    },
    flag: {
        fontSize: 14,
        marginRight: 4,
    },
    countryCode: {
        color: '#B45309',
        fontSize: 13,
        fontWeight: '800',
    },
    helperText: {
        fontSize: 10.5,
        color: '#94A3B8',
        marginTop: 4,
        marginLeft: 2,
    },
    switchCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        borderWidth: 1.2,
        borderColor: '#E2E8F0',
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 14,
    },
    switchLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        paddingRight: 8,
        gap: 10,
    },
    whatsappIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#DCFCE7',
        alignItems: 'center',
        justifyContent: 'center',
    },
    switchTitle: {
        color: '#071435',
        fontSize: 13,
        fontWeight: '700',
    },
    switchSubtitle: {
        color: '#64748B',
        fontSize: 10.5,
        marginTop: 1,
    },
    selectBox: {
        justifyContent: 'space-between',
    },
    selectText: {
        color: '#071435',
        fontSize: 14,
        fontWeight: '600',
    },
    actionContainer: {
        marginTop: 10,
        marginBottom: 12,
    },
    primaryButton: {
        borderRadius: 12,
        overflow: 'hidden',
        elevation: 3,
        shadowColor: '#071435',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
    },
    buttonGradient: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        height: 48,
    },
    btnContentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    logoutButton: {
        alignItems: 'center',
        paddingVertical: 8,
    },
    logoutText: {
        color: '#64748B',
        fontSize: 12.5,
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
    disabledButton: {
        opacity: 0.6,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(7, 20, 53, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    stateModalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 18,
        width: '100%',
        maxWidth: 380,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 8,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#071435',
    },
    modalCloseBtn: {
        padding: 4,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#CBD5E1',
        paddingHorizontal: 10,
        height: 40,
        marginBottom: 10,
    },
    searchInput: {
        flex: 1,
        color: '#071435',
        fontSize: 13,
        fontWeight: '600',
    },
    stateItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 10,
        borderRadius: 8,
        marginBottom: 2,
    },
    selectedStateItem: {
        backgroundColor: '#FEF3C7',
    },
    stateItemText: {
        color: '#334155',
        fontSize: 13.5,
        fontWeight: '500',
    },
    selectedStateItemText: {
        color: '#B45309',
        fontWeight: '800',
    },
});
