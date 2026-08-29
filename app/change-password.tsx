import React, { useState } from 'react';
import { 
    View, Text, TextInput, TouchableOpacity, ScrollView, 
    Alert, ActivityIndicator, Platform, KeyboardAvoidingView 
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../services/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Executive Light Navy & Gold Design Tokens
const L = {
    bg: '#F4F6FB',
    card: '#FFFFFF',
    cardBorder: 'rgba(245, 166, 35, 0.35)',
    navyHeader: '#0F172A',
    navyMid: '#1C2541',
    navyDark: '#0B132B',
    gold: '#F5A623',
    goldDk: '#D97706',
    goldAmber: '#B45309',
    goldBg: 'rgba(254, 243, 199, 0.75)',
    textPrimary: '#0F172A',
    textSecondary: '#334155',
    textMuted: '#64748B',
    inputBg: '#FFFFFF',
    inputBorder: '#CBD5E1',
    emerald: '#10B981',
    emeraldBg: '#ECFDF5',
    emeraldBorder: '#A7F3D0',
    rose: '#E11D48',
    roseBg: '#FFF1F2',
    roseBorder: '#FECDD3'
};

export default function ChangePasswordScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [updating, setUpdating] = useState(false);

    const handleUpdatePassword = async () => {
        if (!newPassword || newPassword.length < 6) {
            return Alert.alert("Password Too Short", "Password must be at least 6 characters long.");
        }

        if (newPassword !== confirmPassword) {
            return Alert.alert("Password Mismatch", "New Password and Confirm Password do not match.");
        }

        setUpdating(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword.trim()
            });

            if (error) throw error;

            Alert.alert(
                "Password Updated! 🎉",
                "Your account login password has been changed successfully.",
                [{ text: "OK", onPress: () => router.back() }]
            );

            setNewPassword('');
            setConfirmPassword('');

        } catch (error: any) {
            console.error("Password Update Error:", error);
            Alert.alert("Update Failed", error.message || "Failed to update password. Please try logging in again.");
        } finally {
            setUpdating(false);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: L.bg, alignItems: 'center' }}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            {/* Mobile-First Container Wrapper (Max 600px for Desktop Web, 100% for Mobile) */}
            <View style={{ flex: 1, width: '100%', maxWidth: 600, backgroundColor: L.bg }}>
                
                {/* Royal Navy Header */}
                <LinearGradient
                    colors={['#0F172A', '#1C2541', '#0B132B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ paddingTop: insets.top + 8, paddingBottom: 14, paddingHorizontal: 14, borderBottomLeftRadius: 18, borderBottomRightRadius: 18, borderBottomWidth: 1.5, borderColor: L.goldDk }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <TouchableOpacity onPress={() => router.back()} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: L.gold, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="arrow-back" size={16} color={L.gold} />
                        </TouchableOpacity>

                        <Text style={{ fontSize: 13, fontWeight: '900', color: L.gold, letterSpacing: -0.2 }}>CHANGE PASSWORD</Text>

                        <View style={{ width: 32 }} />
                    </View>
                </LinearGradient>

                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <ScrollView style={{ flex: 1, paddingHorizontal: 14, paddingTop: 14 }} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
                        
                        {/* Info Banner */}
                        <View style={{ backgroundColor: L.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: L.cardBorder, marginBottom: 14, elevation: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: L.goldBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: L.goldDk }}>
                                <Ionicons name="shield-checkmark-outline" size={20} color={L.goldAmber} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 11 }}>Secure Password Reset</Text>
                                <Text style={{ color: L.textMuted, fontSize: 9.5, marginTop: 1 }}>
                                    Enter your new account password below. Make sure it contains at least 6 characters.
                                </Text>
                            </View>
                        </View>

                        {/* Form Card */}
                        <View style={{ backgroundColor: L.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: L.inputBorder, marginBottom: 14, elevation: 2 }}>
                            
                            {/* New Password Input */}
                            <View style={{ marginBottom: 12 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                    <Text style={{ color: L.textSecondary, fontSize: 9.5, fontWeight: 'bold' }}>New Login Password:</Text>
                                    <TouchableOpacity 
                                        onPress={() => setShowNewPassword(!showNewPassword)}
                                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: showNewPassword ? 'rgba(245, 158, 11, 0.15)' : 'rgba(148, 163, 184, 0.12)' }}
                                    >
                                        <Ionicons name={showNewPassword ? "eye-off" : "eye"} size={12} color={showNewPassword ? "#F59E0B" : L.textMuted} />
                                        <Text style={{ fontSize: 9, fontWeight: 'bold', color: showNewPassword ? "#F59E0B" : L.textMuted }}>
                                            {showNewPassword ? "Hide 🙈" : "Show 👁️"}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={{ height: 40, backgroundColor: L.inputBg, borderRadius: 10, borderWidth: 1, borderColor: L.inputBorder, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Ionicons name="lock-closed-outline" size={16} color={L.navyHeader} />
                                    <TextInput
                                        value={newPassword}
                                        onChangeText={setNewPassword}
                                        secureTextEntry={!showNewPassword}
                                        placeholder="Enter new password..."
                                        placeholderTextColor="#94A3B8"
                                        style={{ flex: 1, color: L.textPrimary, fontSize: 11, fontWeight: '600' }}
                                    />
                                    <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} style={{ padding: 4 }}>
                                        <Ionicons name={showNewPassword ? "eye-off" : "eye"} size={16} color={showNewPassword ? "#F59E0B" : L.textMuted} />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Confirm Password Input */}
                            <View style={{ marginBottom: 14 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                    <Text style={{ color: L.textSecondary, fontSize: 9.5, fontWeight: 'bold' }}>Confirm New Password:</Text>
                                    <TouchableOpacity 
                                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: showConfirmPassword ? 'rgba(245, 158, 11, 0.15)' : 'rgba(148, 163, 184, 0.12)' }}
                                    >
                                        <Ionicons name={showConfirmPassword ? "eye-off" : "eye"} size={12} color={showConfirmPassword ? "#F59E0B" : L.textMuted} />
                                        <Text style={{ fontSize: 9, fontWeight: 'bold', color: showConfirmPassword ? "#F59E0B" : L.textMuted }}>
                                            {showConfirmPassword ? "Hide 🙈" : "Show 👁️"}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={{ height: 40, backgroundColor: L.inputBg, borderRadius: 10, borderWidth: 1, borderColor: L.inputBorder, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Ionicons name="checkmark-done-outline" size={16} color={L.navyHeader} />
                                    <TextInput
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                        secureTextEntry={!showConfirmPassword}
                                        placeholder="Confirm new password..."
                                        placeholderTextColor="#94A3B8"
                                        style={{ flex: 1, color: L.textPrimary, fontSize: 11, fontWeight: '600' }}
                                    />
                                    <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={{ padding: 4 }}>
                                        <Ionicons name={showConfirmPassword ? "eye-off" : "eye"} size={16} color={showConfirmPassword ? "#F59E0B" : L.textMuted} />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Match Validation Indicator */}
                            {confirmPassword.length > 0 && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 }}>
                                    <Ionicons 
                                        name={newPassword === confirmPassword ? "checkmark-circle" : "close-circle"} 
                                        size={14} 
                                        color={newPassword === confirmPassword ? L.emerald : L.rose} 
                                    />
                                    <Text style={{ fontSize: 9, fontWeight: 'bold', color: newPassword === confirmPassword ? L.emerald : L.rose }}>
                                        {newPassword === confirmPassword ? "Passwords match!" : "Passwords do not match."}
                                    </Text>
                                </View>
                            )}

                            {/* Save Password Action Button */}
                            <TouchableOpacity 
                                onPress={handleUpdatePassword}
                                disabled={updating}
                                style={{ height: 40, backgroundColor: L.navyHeader, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, borderWidth: 1, borderColor: L.gold }}
                            >
                                {updating ? (
                                    <ActivityIndicator size="small" color={L.gold} />
                                ) : (
                                    <>
                                        <Ionicons name="key-sharp" size={16} color={L.gold} />
                                        <Text style={{ color: L.gold, fontWeight: '900', fontSize: 10, textTransform: 'uppercase' }}>Update Account Password</Text>
                                    </>
                                )}
                            </TouchableOpacity>

                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </View>
        </View>
    );
}
