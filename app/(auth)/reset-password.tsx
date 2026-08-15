import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator,
    StyleSheet,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';
import { useAppSettings } from '../../hooks/useAppSettings';

export default function ResetPasswordScreen() {
    const { settings } = useAppSettings();
    const router = useRouter();
    const params = useLocalSearchParams<{ email?: string }>();

    const [email, setEmail] = useState<string>(params.email || '');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [userAvatar, setUserAvatar] = useState<string | null>(null);
    const [userName, setUserName] = useState<string>('');

    useEffect(() => {
        fetchUserProfile();
    }, []);

    const fetchUserProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                if (!email && user.email) setEmail(user.email);
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name, avatar_url')
                    .eq('id', user.id)
                    .maybeSingle();

                if (profile?.full_name) setUserName(profile.full_name);
                if (profile?.avatar_url) setUserAvatar(profile.avatar_url);
            }
        } catch (e) {
            console.log('Error fetching user profile in ResetPassword:', e);
        }
    };

    const getPasswordStrength = () => {
        if (!newPassword) return { label: 'Empty', color: '#64748B', width: '0%' };
        if (newPassword.length < 6) return { label: 'Weak', color: '#EF4444', width: '33%' };
        const hasLetter = /[a-zA-Z]/.test(newPassword);
        const hasNumber = /[0-9]/.test(newPassword);
        if (hasLetter && hasNumber && newPassword.length >= 8) {
            return { label: 'Strong 🔒', color: '#10B981', width: '100%' };
        }
        return { label: 'Good', color: '#F59E0B', width: '66%' };
    };

    const handleUpdatePassword = async () => {
        if (!newPassword || newPassword.length < 6) {
            const msg = 'Password must be at least 6 characters long.';
            if (Platform.OS === 'web') alert(msg);
            else Alert.alert('Invalid Password', msg);
            return;
        }

        if (newPassword !== confirmPassword) {
            const msg = 'Passwords do not match. Please re-enter your password.';
            if (Platform.OS === 'web') alert(msg);
            else Alert.alert('Password Mismatch', msg);
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword,
            });

            if (error) throw error;

            const msg = 'Success! Your account password has been updated successfully.';
            if (Platform.OS === 'web') {
                alert(msg);
                router.replace('/(auth)/login' as any);
            } else {
                Alert.alert('Password Updated', msg, [
                    { text: 'Log In Now', onPress: () => router.replace('/(auth)/login' as any) },
                ]);
            }
        } catch (error: any) {
            const errMsg = error.message || 'Failed to update password. Please try again.';
            if (Platform.OS === 'web') alert(errMsg);
            else Alert.alert('Error', errMsg);
        } finally {
            setLoading(false);
        }
    };

    const getUserInitial = () => {
        if (userName && userName.trim()) return userName.trim().charAt(0).toUpperCase();
        if (email && email.trim()) return email.trim().charAt(0).toUpperCase();
        return 'U';
    };

    const strength = getPasswordStrength();

    return (
        <View style={s.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            {/* Deep Royal Mesh Gradient */}
            <LinearGradient colors={['#020617', '#0F172A', '#020617']} style={StyleSheet.absoluteFillObject} />

            {/* Glowing Ambient Lights */}
            <View style={s.topGlow} />
            <View style={s.bottomGlow} />

            <SafeAreaView style={s.safeArea}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={s.keyboardView}
                >
                    {/* Top Bar Header */}
                    <View style={s.topBar}>
                        <TouchableOpacity
                            onPress={() => {
                                if (router.canGoBack()) router.back();
                                else router.replace('/(auth)/login' as any);
                            }}
                            style={s.backBtn}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="arrow-back" size={18} color="#F59E0B" />
                        </TouchableOpacity>

                        <View style={s.securityBadge}>
                            <Ionicons name="shield-checkmark" size={12} color="#F59E0B" />
                            <Text style={s.securityBadgeText}>PASSWORD RESET</Text>
                        </View>

                        <View style={{ width: 32 }} />
                    </View>

                    {/* Compact Card Content */}
                    <View style={s.card}>
                        {/* User Avatar / Logo Badge */}
                        <View style={s.avatarWrapper}>
                            <LinearGradient colors={['#F59E0B', '#D97706', '#78350F']} style={s.avatarBorderRing}>
                                {userAvatar ? (
                                    <Image source={{ uri: userAvatar }} style={s.avatarImage} />
                                ) : (
                                    <View style={s.avatarFallback}>
                                        <Text style={s.avatarInitialText}>{getUserInitial()}</Text>
                                    </View>
                                )}
                            </LinearGradient>
                            <View style={s.activeBadge}>
                                <Ionicons name="key" size={11} color="#020617" />
                            </View>
                        </View>

                        {/* Title & Subtitle */}
                        <Text style={s.titleText}>Set New Password</Text>
                        <Text style={s.subtitleText}>Create a strong new password for your account</Text>
                        {email ? <Text style={s.emailHighlightText}>{email}</Text> : null}

                        {/* New Password Input */}
                        <View style={s.inputContainer}>
                            <Ionicons name="lock-closed-outline" size={18} color="#F59E0B" style={s.inputIcon} />
                            <TextInput
                                style={s.input}
                                placeholder="Enter New Password"
                                placeholderTextColor="#64748B"
                                secureTextEntry={!showPassword}
                                value={newPassword}
                                onChangeText={setNewPassword}
                                selectionColor="#F59E0B"
                            />
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={s.eyeBtn}>
                                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>

                        {/* Password Strength Indicator Bar */}
                        {newPassword.length > 0 && (
                            <View style={s.strengthWrapper}>
                                <View style={s.strengthBarBackground}>
                                    <View style={[s.strengthBarFill, { width: strength.width as any, backgroundColor: strength.color }]} />
                                </View>
                                <Text style={[s.strengthText, { color: strength.color }]}>{strength.label}</Text>
                            </View>
                        )}

                        {/* Confirm Password Input */}
                        <View style={s.inputContainer}>
                            <Ionicons name="checkmark-circle-outline" size={18} color="#F59E0B" style={s.inputIcon} />
                            <TextInput
                                style={s.input}
                                placeholder="Confirm New Password"
                                placeholderTextColor="#64748B"
                                secureTextEntry={!showConfirmPassword}
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                selectionColor="#F59E0B"
                            />
                            <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={s.eyeBtn}>
                                <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>

                        {/* Submit Button */}
                        <TouchableOpacity
                            onPress={handleUpdatePassword}
                            disabled={loading}
                            activeOpacity={0.8}
                            style={s.submitBtnWrapper}
                        >
                            <LinearGradient
                                colors={['#F59E0B', '#D97706']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={s.submitBtnGradient}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#020617" size="small" />
                                ) : (
                                    <View style={s.submitBtnContent}>
                                        <Ionicons name="save-outline" size={18} color="#020617" />
                                        <Text style={s.submitBtnText}>Update Account Password</Text>
                                    </View>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#020617',
    },
    topGlow: {
        position: 'absolute',
        top: -80,
        alignSelf: 'center',
        width: 280,
        height: 280,
        borderRadius: 140,
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
    },
    bottomGlow: {
        position: 'absolute',
        bottom: -80,
        alignSelf: 'center',
        width: 300,
        height: 300,
        borderRadius: 150,
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
    },
    safeArea: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 16,
        alignSelf: 'center',
        width: '100%',
        maxWidth: 340,
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 6,
    },
    backBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderColor: 'rgba(245, 158, 11, 0.3)',
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    securityBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderColor: 'rgba(245, 158, 11, 0.3)',
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 16,
    },
    securityBadgeText: {
        color: '#F59E0B',
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    card: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
    },
    avatarWrapper: {
        position: 'relative',
        marginBottom: 10,
    },
    avatarBorderRing: {
        width: 58,
        height: 58,
        borderRadius: 29,
        padding: 2.5,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    avatarImage: {
        width: 53,
        height: 53,
        borderRadius: 26.5,
        backgroundColor: '#0F172A',
    },
    avatarFallback: {
        width: 53,
        height: 53,
        borderRadius: 26.5,
        backgroundColor: '#0F172A',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    avatarInitialText: {
        color: '#F59E0B',
        fontSize: 22,
        fontWeight: '900',
    },
    activeBadge: {
        position: 'absolute',
        bottom: 1,
        right: 1,
        backgroundColor: '#F59E0B',
        borderRadius: 8,
        width: 16,
        height: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    titleText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: -0.3,
        marginBottom: 3,
    },
    subtitleText: {
        color: '#94A3B8',
        fontSize: 11,
        fontWeight: '500',
        textAlign: 'center',
    },
    emailHighlightText: {
        color: '#F59E0B',
        fontSize: 12,
        fontWeight: '700',
        marginTop: 1,
        marginBottom: 18,
    },
    inputContainer: {
        width: '100%',
        height: 48,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderColor: 'rgba(245, 158, 11, 0.3)',
        borderWidth: 1,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        marginBottom: 10,
    },
    inputIcon: {
        marginRight: 8,
    },
    input: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    eyeBtn: {
        padding: 4,
    },
    strengthWrapper: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        paddingHorizontal: 2,
    },
    strengthBarBackground: {
        flex: 1,
        height: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 2,
        marginRight: 10,
        overflow: 'hidden',
    },
    strengthBarFill: {
        height: '100%',
        borderRadius: 2,
    },
    strengthText: {
        fontSize: 10,
        fontWeight: '800',
    },
    submitBtnWrapper: {
        width: '100%',
        marginTop: 8,
    },
    submitBtnGradient: {
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 5,
    },
    submitBtnContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    submitBtnText: {
        color: '#020617',
        fontSize: 14,
        fontWeight: '800',
    },
});
