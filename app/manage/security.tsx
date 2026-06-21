import { View, Text, ScrollView, TouchableOpacity, Switch, ActivityIndicator, Modal, TextInput, Image, Alert, Platform, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import * as Clipboard from 'expo-clipboard';

export default function SecuritySub() {
    const [sessions, setSessions] = useState<any[]>([]);
    const [biometric, setBiometric] = useState(false);
    const [loading, setLoading] = useState(true);

    // Supabase MFA (2FA TOTP) states
    const [mfaFactor, setMfaFactor] = useState<any>(null);
    const [isMfaActive, setIsMfaActive] = useState(false);
    const [setupModalVisible, setSetupModalVisible] = useState(false);
    const [enrollData, setEnrollData] = useState<any>(null);
    const [verificationCode, setVerificationCode] = useState('');
    const [verifying, setVerifying] = useState(false);

    useEffect(() => {
        const initialize = async () => {
            await fetchSecurityState();
            await checkMfaStatus();
        };
        initialize();
    }, []);

    const fetchSecurityState = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setSessions([
                    { id: '1', device: 'Current Device', ip: 'Connected', loc: 'Your Location', current: true, lastActive: 'Now' }
                ]);
            }
        } catch (e) {
            console.error("Fetch security error:", e);
        } finally {
            setLoading(false);
        }
    };

    const checkMfaStatus = async () => {
        try {
            const { data, error } = await supabase.auth.mfa.listFactors();
            if (error) throw error;
            if (data && data.totp) {
                const activeFactor = data.totp.find(f => f.status === 'verified');
                setMfaFactor(activeFactor || null);
                setIsMfaActive(!!activeFactor);
            }
        } catch (e) {
            console.error("MFA status check failed:", e);
        }
    };

    const handleToggleMfa = async (value: boolean) => {
        if (value) {
            // Enable 2FA: Start Supabase enrollment
            setLoading(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error("User not found");

                const { data, error } = await supabase.auth.mfa.enroll({
                    factorType: 'totp',
                    issuer: 'Mafhal Sub',
                    friendlyName: user.email || 'Admin'
                });

                if (error) throw error;

                setEnrollData(data);
                setSetupModalVisible(true);
            } catch (err: any) {
                Alert.alert("2FA Enrollment Error", err.message || "Failed to start 2FA enrollment.");
            } finally {
                setLoading(false);
            }
        } else {
            // Disable 2FA: Prompt confirmation first
            Alert.alert(
                "Disable 2FA",
                "Are you sure you want to disable Google Authenticator 2FA? This will significantly lower your account security.",
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Disable",
                        style: "destructive",
                        onPress: async () => {
                            if (!mfaFactor) return;
                            setLoading(true);
                            try {
                                const { error } = await supabase.auth.mfa.unenroll({
                                    factorId: mfaFactor.id
                                });
                                if (error) throw error;

                                Alert.alert("Success", "Two-factor authentication has been disabled.");
                                await checkMfaStatus();
                            } catch (err: any) {
                                Alert.alert("Error", err.message || "Failed to disable 2FA.");
                            } finally {
                                setLoading(false);
                            }
                        }
                    }
                ]
            );
        }
    };

    const handleVerifySetup = async () => {
        if (verificationCode.trim().length !== 6) {
            Alert.alert("Invalid Code", "Please enter the 6-digit verification code from Google Authenticator.");
            return;
        }

        setVerifying(true);
        try {
            // Challenge the enrolled TOTP factor
            const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
                factorId: enrollData.id
            });
            if (challengeError) throw challengeError;

            // Verify the TOTP code
            const { error: verifyError } = await supabase.auth.mfa.verify({
                factorId: enrollData.id,
                challengeId: challengeData.id,
                code: verificationCode.trim()
            });
            if (verifyError) throw verifyError;

            Alert.alert("Success", "Google Two-Factor Authentication is now enabled!", [
                {
                    text: "Done",
                    onPress: async () => {
                        setSetupModalVisible(false);
                        setVerificationCode('');
                        setEnrollData(null);
                        await checkMfaStatus();
                    }
                }
            ]);
        } catch (err: any) {
            Alert.alert("Verification Failed", err.message || "Invalid 6-digit code. Please check and try again.");
        } finally {
            setVerifying(false);
        }
    };

    const handleCancelSetup = async () => {
        if (enrollData?.id) {
            // Clean up unverified factor from Supabase to prevent dangling enrollments
            await supabase.auth.mfa.unenroll({ factorId: enrollData.id });
        }
        setSetupModalVisible(false);
        setVerificationCode('');
        setEnrollData(null);
    };

    const handleCopySecret = async () => {
        if (enrollData?.totp?.secret) {
            await Clipboard.setStringAsync(enrollData.totp.secret);
            Alert.alert("Copied", "Secret Key copied to clipboard.");
        }
    };

    const qrUrl = enrollData?.totp?.uri
        ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(enrollData.totp.uri)}`
        : '';

    return (
        <ScrollView className="flex-1 bg-slate-900">
            <Stack.Screen options={{
                title: 'Security Command',
                headerStyle: { backgroundColor: '#0F172A' },
                headerTintColor: '#fff'
            }} />

            <View className="p-6">
                <View className="flex-row items-center mb-6">
                    <View className="w-16 h-16 bg-blue-500/10 rounded-full items-center justify-center mr-4 border border-blue-500/30">
                        <Ionicons name="shield-checkmark" size={32} color="#3B82F6" />
                    </View>
                    <View>
                        <Text className="text-white text-2xl font-black">Security Sub</Text>
                        <Text className="text-slate-400 font-medium">System Integrity & Access</Text>
                    </View>
                </View>

                {/* Authentication Controls */}
                <View className="bg-slate-800/50 rounded-2xl border border-slate-700 p-4 mb-8">
                    <Text className="text-slate-400 font-bold uppercase text-[10px] mb-4 tracking-wider">Authentication Policy</Text>

                    {/* Require 2FA (Google Authenticator) */}
                    <View className="flex-row items-center justify-between mb-6">
                        <View className="flex-row items-center gap-3" style={{ flex: 1 }}>
                            <View className="bg-orange-500/20 p-2 rounded-lg">
                                <Ionicons name="key" size={18} color="#F97316" />
                            </View>
                            <View style={{ flex: 1, paddingRight: 8 }}>
                                <Text className="text-white font-bold">Google Authenticator (2FA)</Text>
                                <Text className="text-slate-500 text-xs">Verify your identity using a 6-digit TOTP app code</Text>
                            </View>
                        </View>
                        <Switch
                            value={isMfaActive}
                            onValueChange={handleToggleMfa}
                            trackColor={{ false: '#334155', true: '#F97316' }}
                            thumbColor="white"
                        />
                    </View>

                    {/* Biometric Gating */}
                    <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-3">
                            <View className="bg-purple-500/20 p-2 rounded-lg">
                                <Ionicons name="finger-print" size={18} color="#A855F7" />
                            </View>
                            <View>
                                <Text className="text-white font-bold">Biometric Gating</Text>
                                <Text className="text-slate-500 text-xs">Require face / fingerprint check on admin load</Text>
                            </View>
                        </View>
                        <Switch
                            value={biometric}
                            onValueChange={setBiometric}
                            trackColor={{ false: '#334155', true: '#A855F7' }}
                            thumbColor="white"
                        />
                    </View>
                </View>

                {/* Active Sessions */}
                <Text className="text-slate-400 font-bold uppercase text-[10px] mb-3 ml-1 tracking-wider">Active Sessions</Text>
                <View className="bg-slate-800 rounded-xl p-4 mb-3 border border-slate-700 flex-row justify-between items-center">
                    <View className="flex-row items-center gap-3">
                        <Ionicons
                            name="laptop"
                            size={20}
                            color="#64748B"
                        />
                        <View>
                            <View className="flex-row items-center gap-2">
                                <Text className="text-slate-200 font-bold">Current Session</Text>
                                <View className="bg-green-500/20 px-1.5 py-0.5 rounded">
                                    <Text className="text-green-500 text-[8px] font-bold uppercase">Active</Text>
                                </View>
                            </View>
                            <Text className="text-slate-500 text-xs">Console • Connected</Text>
                        </View>
                    </View>
                    <Text className="text-green-500 text-xs font-bold">Online</Text>
                </View>
            </View>

            {/* Google 2FA Enrollment Setup Modal */}
            <Modal
                visible={setupModalVisible}
                transparent
                animationType="slide"
                onRequestClose={handleCancelSetup}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <MaterialCommunityIcons name={"google-authenticator" as any} size={28} color="#F97316" />
                            <Text style={styles.modalTitle}>Set Up Google 2FA</Text>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
                            <Text style={styles.stepText}>
                                1. Scan the QR code using Google Authenticator or any TOTP app:
                            </Text>

                            {qrUrl ? (
                                <View style={styles.qrContainer}>
                                    <Image source={{ uri: qrUrl }} style={styles.qrImage} resizeMode="contain" />
                                </View>
                            ) : (
                                <ActivityIndicator size="small" color="#F97316" style={{ marginVertical: 20 }} />
                            )}

                            <Text style={styles.stepText}>
                                2. Or enter the Secret Key manually:
                            </Text>

                            <View style={styles.secretBox}>
                                <Text style={styles.secretText}>{enrollData?.totp?.secret || ''}</Text>
                                <TouchableOpacity onPress={handleCopySecret} style={styles.copyBtn}>
                                    <Ionicons name="copy-outline" size={16} color="#0d1b3e" />
                                    <Text style={styles.copyBtnText}>Copy</Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.stepText}>
                                3. Enter the 6-digit code shown in your app to activate:
                            </Text>

                            <TextInput
                                style={styles.codeInput}
                                placeholder="000000"
                                placeholderTextColor="#94a3b8"
                                keyboardType="number-pad"
                                maxLength={6}
                                value={verificationCode}
                                onChangeText={setVerificationCode}
                            />
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity onPress={handleCancelSetup} style={styles.cancelBtn}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={handleVerifySetup} disabled={verifying} style={styles.verifyBtn}>
                                {verifying ? (
                                    <ActivityIndicator size="small" color="white" />
                                ) : (
                                    <Text style={styles.verifyBtnText}>Verify & Enable</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.85)', // Dark translucent slate
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalCard: {
        backgroundColor: '#ffffff',
        borderRadius: 24,
        width: '100%',
        maxWidth: 340,
        maxHeight: '90%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 15,
        elevation: 10,
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        gap: 10,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#0f172a',
    },
    modalScroll: {
        padding: 20,
    },
    stepText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
        lineHeight: 16,
        marginBottom: 8,
    },
    qrContainer: {
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        padding: 12,
        alignSelf: 'center',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    qrImage: {
        width: 140,
        height: 140,
    },
    secretBox: {
        backgroundColor: '#f1f5f9',
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#cbd5e1',
    },
    secretText: {
        fontSize: 13,
        fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
        fontWeight: '700',
        color: '#334155',
        flex: 1,
        marginRight: 10,
    },
    copyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f5a623',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        gap: 4,
    },
    copyBtnText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#0d1b3e',
    },
    codeInput: {
        borderWidth: 2,
        borderColor: '#cbd5e1',
        borderRadius: 14,
        height: 48,
        fontSize: 20,
        fontWeight: '800',
        color: '#0f172a',
        textAlign: 'center',
        letterSpacing: 8,
        backgroundColor: '#f8fafc',
        marginBottom: 10,
    },
    modalFooter: {
        flexDirection: 'row',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        justifyContent: 'space-between',
        gap: 10,
    },
    cancelBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#cbd5e1',
        alignItems: 'center',
    },
    cancelBtnText: {
        color: '#475569',
        fontSize: 13,
        fontWeight: '700',
    },
    verifyBtn: {
        flex: 1.5,
        backgroundColor: '#0d1b3e',
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    verifyBtnText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '800',
    },
});
