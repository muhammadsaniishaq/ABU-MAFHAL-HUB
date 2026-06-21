import { View, Text, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Image, ScrollView, ActivityIndicator, StyleSheet, useWindowDimensions, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

WebBrowser.maybeCompleteAuthSession();

export default function Login() {
    const { width, height } = useWindowDimensions();
    const isSmall = width < 800;
    const isVerySmall = width < 600;
    const isShort = height < 760;

    // Dynamic sizes and spaces to lock viewport without scroll
    const scale = isVerySmall ? 0.8 : isSmall ? 0.9 : 1;

    const podiumHeight = (isShort ? 320 : 450) * scale;
    const podiumWidth = podiumHeight * 0.85;

    const bodyGap = 12 * scale;

    // Responsive margins and paddings
    const spacing = {
        topNavMargin: 20 * scale,
        bodyMargin: 20 * scale,
        featuresMargin: 16 * scale,
        featuresPadding: 12 * scale,
        partnersMargin: 16 * scale,
        partnersPadding: 12 * scale,
        containerPaddingTop: 12 * scale,
        containerPaddingBottom: 16 * scale,
        cardPaddingTop: 20 * scale,
        cardPaddingBottom: 20 * scale,
        cardPaddingHorizontal: 32 * scale,
        inputMargin: 10 * scale,
        orMargin: 10 * scale,
        copyrightMarginTop: 12 * scale,
    };

    const [identifier, setIdentifier] = useState(''); // Email or Phone
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingGoogle, setLoadingGoogle] = useState(false);
    const router = useRouter();
    const { redirectTo } = useLocalSearchParams<{ redirectTo?: string }>();

    const handleLogin = async () => {
        if (!identifier || !password) {
            Alert.alert('Error', 'Please enter your phone/email and password');
            return;
        }

        setLoading(true);
        try {
            const isEmail = identifier.includes('@');
            const loginCredentials = isEmail 
                ? { email: identifier.trim(), password }
                : { phone: identifier.trim(), password };

            const { data, error } = await supabase.auth.signInWithPassword(loginCredentials);

            if (error) {
                if (error.message.includes('Email not confirmed') || error.message.includes('Email not verified')) {
                    router.push({
                        pathname: '/(auth)/otp',
                        params: { email: isEmail ? identifier : '', type: 'signup' }
                    });
                    return;
                }
                throw error;
            }

            if (data.user) {
                let ip = "Unknown IP";
                try {
                    const res = await fetch('https://api.ipify.org?format=json');
                    const json = await res.json();
                    ip = json.ip;
                } catch (e) { console.log("Failed to fetch IP", e); }

                await supabase.from('notifications').insert({
                    user_id: data.user.id,
                    title: "New Login Detected 🔐",
                    body: `New login from IP: ${ip} on ${Platform.OS.toUpperCase()}.`,
                    data: { priority: 'high', type: 'security', ip }
                });

                try {
                    await supabase.functions.invoke('send-communication', {
                        body: {
                            type: 'email',
                            recipient_mode: 'single',
                            recipient: data.user.email || '',
                            subject: "🔐 Security Alert: New Login Detected",
                            body: `<h3>New Login Detected</h3><p>We noticed a new login to your account.</p><p><b>Device:</b> ${Platform.OS.toUpperCase()}</p><p><b>IP Address:</b> ${ip}</p><p><b>Time:</b> ${new Date().toLocaleString()}</p><p>If this was you, you can ignore this email.</p>`
                        }
                    });
                } catch (e) { console.log("Communication function invocation failed", e); }

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', data.user.id)
                    .single();

                await AsyncStorage.setItem('last_security_verification_time', String(Date.now()));

                if (redirectTo) {
                    router.replace(redirectTo as any);
                } else {
                    router.replace('/(app)/dashboard');
                }
            }
        } catch (error: any) {
            Alert.alert('Login Failed', error.message || 'Please check your credentials');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        if (loadingGoogle) return;
        setLoadingGoogle(true);
        console.log('Google login clicked');
        try {
            if (Platform.OS === 'web') {
                const redirectTo = window.location.origin;
                const { error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo
                    }
                });
                if (error) throw error;
            } else {
                // Native platform: use PKCE with expo-web-browser
                const redirectTo = Linking.createURL('/(auth)/login');
                const { data, error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo,
                        skipBrowserRedirect: true,
                    }
                });
                if (error) throw error;
                
                if (data?.url) {
                    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
                    if (result.type === 'success' && result.url) {
                        // If it has hash parameters, replace '#' with '?' to make it parseable as query params
                        const normalizedUrl = result.url.replace('#', '?');
                        const parsed = Linking.parse(normalizedUrl);
                        const { code, access_token, refresh_token } = parsed.queryParams || {};
                        const codeStr = Array.isArray(code) ? code[0] : code;
                        const accessTokenStr = Array.isArray(access_token) ? access_token[0] : access_token;
                        const refreshTokenStr = Array.isArray(refresh_token) ? refresh_token[0] : refresh_token;

                        if (codeStr) {
                            const { error: sessionError } = await supabase.auth.exchangeCodeForSession(codeStr);
                            if (sessionError) throw sessionError;
                        } else if (accessTokenStr && refreshTokenStr) {
                            const { error: sessionError } = await supabase.auth.setSession({
                                access_token: accessTokenStr,
                                refresh_token: refreshTokenStr,
                            });
                            if (sessionError) throw sessionError;
                        }
                    }
                }
            }
        } catch (error: any) {
            console.error('Google Auth Error:', error);
            if (Platform.OS === 'web') {
                alert('Google Login Error: ' + (error.message || 'Something went wrong'));
            } else {
                Alert.alert('Google Login Error', error.message || 'Something went wrong');
            }
        } finally {
            setLoadingGoogle(false);
        }
    };

    return (
        <View style={s.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="dark" />
            
            <SafeAreaView style={{ flex: 1 }}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                >
                    <ScrollView 
                        contentContainerStyle={[
                            s.scrollContainer, 
                            { 
                                paddingHorizontal: 20 * scale,
                                paddingTop: spacing.containerPaddingTop, 
                                paddingBottom: spacing.containerPaddingBottom 
                            }
                        ]} 
                        showsVerticalScrollIndicator={false}
                        scrollEnabled={true}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* TOP BRAND NAVIGATION ROW */}
                        <View style={[s.topNav, { marginBottom: spacing.topNavMargin }]}>
                            <View style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                                <View style={s.brandLogoRow}>
                                    <Image 
                                        source={require('../../assets/images/logo.png')}
                                        style={s.brandLogo}
                                        resizeMode="contain"
                                    />
                                    <View style={{ marginLeft: 8 }}>
                                        <Text style={s.brandText}>MAFHAL</Text>
                                        <Text style={s.brandSubtext}>SUB</Text>
                                    </View>
                                </View>
                                <Text style={s.oneSubTextLeft}>One Sub. Endless Possibilities.</Text>
                            </View>

                            <TouchableOpacity style={s.langSelector}>
                                <Ionicons name="globe-outline" size={14} color="#0f172a" style={{ marginRight: 6 }} />
                                <Text style={s.langText}>English</Text>
                                <Ionicons name="chevron-down" size={10} color="#0f172a" style={{ marginLeft: 4 }} />
                            </TouchableOpacity>
                        </View>

                        {/* RESPONSIVE BODY SECTION */}
                        <View style={[
                            isSmall ? s.bodyColumn : s.bodyRow, 
                            { marginBottom: spacing.bodyMargin, gap: isSmall ? 0 : bodyGap }
                        ]}>
                            
                            {/* LEFT SIDE: HERO PRESENTATION */}
                            {!isSmall && (
                                <View style={s.heroLeft}>
                                    <View style={s.welcomeTextContainer}>
                                        <Text style={[s.welcomeMain, { fontSize: 36 * scale }]}>Welcome</Text>
                                        <Text style={[s.welcomeHighlight, { fontSize: 36 * scale }]}>Back!</Text>
                                        <View style={[s.yellowUnderline, { width: 56 * scale, marginTop: 4 * scale }]} />
                                    </View>

                                    <Text style={[s.heroSubtext, { fontSize: 13 * scale, marginTop: 12 * scale, marginBottom: 12 * scale }]}>
                                        Sign in to your account and explore a world of seamless payments.
                                    </Text>

                                    <View style={s.podiumWrapper}>
                                        <Image
                                            source={require('../../assets/images/ceo.jpg')}
                                            style={s.podiumImage}
                                            resizeMode="cover"
                                        />
                                        {/* Bottom Blur/Fade-out for the image */}
                                        <LinearGradient
                                            colors={['rgba(248, 250, 252, 0)', 'rgba(248, 250, 252, 0.8)', 'rgba(248, 250, 252, 1)']}
                                            style={s.bottomBlur}
                                            pointerEvents="none"
                                        />
                                    </View>
                                </View>
                            )}

                            {/* RIGHT SIDE: LOGIN CARD */}
                            <View style={isSmall ? s.cardCenter : s.cardRight}>
                                <View style={[
                                    s.loginCard,
                                    {
                                        marginTop: isSmall ? 40 * scale : 80 * scale,
                                        paddingTop: spacing.cardPaddingTop,
                                        paddingBottom: spacing.cardPaddingBottom,
                                        paddingHorizontal: spacing.cardPaddingHorizontal,
                                    }
                                ]}>
                                    {/* Floating User Profile Icon Badge */}
                                    <View style={[s.userIconCircle, { width: 56 * scale, height: 56 * scale, borderRadius: 28 * scale, top: -28 * scale }]}>
                                        <Ionicons name="person" size={24 * scale} color="#0056D2" />
                                    </View>

                                    <Text style={[s.cardTitle, { fontSize: 24 * scale }]}>
                                        Login to <Text style={{ color: '#d97706' }}>Mafhal Sub</Text>
                                    </Text>
                                    <Text style={[s.cardSubtitle, { fontSize: 12 * scale, marginBottom: 20 * scale }]}>Enter your details to continue</Text>

                                    {/* Input: Identifier */}
                                    <View style={[s.inputContainer, { marginBottom: spacing.inputMargin }]}>
                                        <Text style={[s.inputLabel, { fontSize: 12 * scale }]}>Phone Number or Email</Text>
                                        <View style={[s.inputBox, { height: 46 * scale, borderRadius: 12 * scale, paddingHorizontal: 12 * scale }]}>
                                            <Ionicons name="person-outline" size={18 * scale} color="#94a3b8" style={s.inputIcon} />
                                            <TextInput
                                                style={[s.textInput, { fontSize: 13 * scale }]}
                                                placeholder="Enter phone number or email"
                                                placeholderTextColor="#94a3b8"
                                                value={identifier}
                                                onChangeText={setIdentifier}
                                                autoCapitalize="none"
                                                selectionColor="#0056D2"
                                            />
                                        </View>
                                    </View>

                                    {/* Input: Password */}
                                    <View style={[s.inputContainer, { marginBottom: spacing.inputMargin }]}>
                                        <Text style={[s.inputLabel, { fontSize: 12 * scale }]}>Password</Text>
                                        <View style={[s.inputBox, { height: 46 * scale, borderRadius: 12 * scale, paddingHorizontal: 12 * scale }]}>
                                            <Ionicons name="lock-closed-outline" size={18 * scale} color="#94a3b8" style={s.inputIcon} />
                                            <TextInput
                                                style={[s.textInput, { fontSize: 13 * scale }]}
                                                placeholder="Enter your password"
                                                placeholderTextColor="#94a3b8"
                                                secureTextEntry={!showPassword}
                                                value={password}
                                                onChangeText={setPassword}
                                                selectionColor="#0056D2"
                                            />
                                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                                <Ionicons 
                                                    name={showPassword ? "eye-off-outline" : "eye-outline"} 
                                                    size={18 * scale} 
                                                    color="#94a3b8" 
                                                />
                                            </TouchableOpacity>
                                        </View>
                                        
                                        <TouchableOpacity style={s.forgotLink}>
                                            <Text style={[s.forgotText, { fontSize: 12 * scale }]}>Forgot Password?</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {/* Login Button */}
                                    <TouchableOpacity
                                        onPress={handleLogin}
                                        disabled={loading}
                                        activeOpacity={0.8}
                                        style={[s.loginButton, { marginTop: 8 * scale, borderRadius: 12 * scale }]}
                                    >
                                        <LinearGradient
                                            colors={['#eab308', '#d97706']}
                                            style={[s.loginButtonGradient, { height: 46 * scale }]}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                        >
                                            {loading ? (
                                                <ActivityIndicator color="white" size="small" />
                                            ) : (
                                                <View style={s.buttonInner}>
                                                    <View style={{ width: 16 * scale }} />
                                                    <Text style={[s.loginButtonText, { fontSize: 15 * scale }]}>Login</Text>
                                                    <Ionicons name="arrow-forward" size={20 * scale} color="#ffffff" style={s.buttonArrow} />
                                                </View>
                                            )}
                                        </LinearGradient>
                                    </TouchableOpacity>

                                    {/* OR Separator */}
                                    <View style={[s.orSeparatorRow, { marginVertical: spacing.orMargin }]}>
                                        <View style={s.separatorLine} />
                                        <Text style={[s.orText, { fontSize: 11 * scale, marginHorizontal: 12 * scale }]}>OR</Text>
                                        <View style={s.separatorLine} />
                                    </View>

                                    {/* Google Button */}
                                    <TouchableOpacity 
                                        onPress={handleGoogleLogin} 
                                        disabled={loadingGoogle || loading}
                                        style={[s.googleButton, { height: 46 * scale, borderRadius: 12 * scale }]} 
                                        activeOpacity={0.7}
                                    >
                                        {loadingGoogle ? (
                                            <ActivityIndicator color="#334155" size="small" />
                                        ) : (
                                            <>
                                                <Image 
                                                    source={{ uri: 'https://www.google.com/images/branding/googleg/1x/googleg_standard_color_128dp.png' }} 
                                                    style={{ width: 20 * scale, height: 20 * scale, marginRight: 10 * scale }}
                                                    resizeMode="contain"
                                                />
                                                <Text style={[s.googleButtonText, { fontSize: 13 * scale }]}>Continue with Google</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>

                                    {/* Signup Link */}
                                    <View style={[s.signupFooter, { marginTop: 20 * scale }]}>
                                        <Text style={[s.signupFooterNormal, { fontSize: 13 * scale }]}>Don't have an account? </Text>
                                        <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
                                            <Text style={[s.signupFooterLink, { fontSize: 13 * scale }]}>Create Account</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>

                        </View>

                        {/* FEATURES ROW (ARRANGED EXACTLY LIKE THE REFERENCE IMAGE) */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }} style={{ width: '100%', marginBottom: spacing.featuresMargin }}>
                        <View style={[
                            s.featuresRow, 
                            { 
                                paddingVertical: spacing.featuresPadding 
                            }
                        ]}>
                            <View style={s.featureCard}>
                                        <View style={[s.featureIconCircle, { width: 44 * scale, height: 44 * scale, borderRadius: 22 * scale, backgroundColor: 'rgba(0, 86, 210, 0.08)', marginBottom: 8 * scale }]}>
                                            <Ionicons name="shield-checkmark" size={20 * scale} color="#0056D2" />
                                        </View>
                                        <Text style={[s.featureTitle, { fontSize: 12 * scale }]}>Secure</Text>
                                        <Text style={[s.featureDesc, { fontSize: 10 * scale }]}>Top-tier security{"\n"}to keep you safe</Text>
                                    </View>

                                    <View style={[s.verticalDivider, { height: 40 * scale }]} />

                                    <View style={s.featureCard}>
                                        <View style={[s.featureIconCircle, { width: 44 * scale, height: 44 * scale, borderRadius: 22 * scale, backgroundColor: 'rgba(245, 166, 35, 0.08)', marginBottom: 8 * scale }]}>
                                            <Ionicons name="flash" size={20 * scale} color="#eab308" />
                                        </View>
                                        <Text style={[s.featureTitle, { fontSize: 12 * scale }]}>Fast</Text>
                                        <Text style={[s.featureDesc, { fontSize: 10 * scale }]}>Instant payments{"\n"}in seconds</Text>
                                    </View>

                                    <View style={[s.verticalDivider, { height: 40 * scale }]} />

                                    <View style={s.featureCard}>
                                        <View style={[s.featureIconCircle, { width: 44 * scale, height: 44 * scale, borderRadius: 22 * scale, backgroundColor: 'rgba(139, 92, 246, 0.08)', marginBottom: 8 * scale }]}>
                                            <Ionicons name="ribbon" size={20 * scale} color="#8b5cf6" />
                                        </View>
                                        <Text style={[s.featureTitle, { fontSize: 12 * scale }]}>Reliable</Text>
                                        <Text style={[s.featureDesc, { fontSize: 10 * scale }]}>Dependable services{"\n"}you can trust</Text>
                                    </View>

                                    <View style={[s.verticalDivider, { height: 40 * scale }]} />

                                    <View style={s.featureCard}>
                                        <View style={[s.featureIconCircle, { width: 44 * scale, height: 44 * scale, borderRadius: 22 * scale, backgroundColor: 'rgba(16, 185, 129, 0.08)', marginBottom: 8 * scale }]}>
                                            <Ionicons name="headset" size={20 * scale} color="#10b981" />
                                        </View>
                                        <Text style={[s.featureTitle, { fontSize: 12 * scale }]}>24/7 Support</Text>
                                        <Text style={[s.featureDesc, { fontSize: 10 * scale }]}>We're always here{"\n"}to help you</Text>
                                    </View>
                        </View>
                        </ScrollView>

                        {/* UNIFIED SECURITY & PARTNERS CARD */}
                        <View style={[
                            s.securityPartnersCard, 
                            { 
                                flexDirection: isSmall ? 'column' : 'row',
                                alignItems: 'center',
                                gap: isSmall ? 16 : 0,
                                marginBottom: spacing.partnersMargin, 
                                paddingVertical: spacing.partnersPadding 
                            }
                        ]}>
                            <View style={[s.securityFooterLeft, isSmall && { justifyContent: 'center', width: '100%' }]}>
                                <View style={[s.securityFooterIconCircle, { width: 26 * scale, height: 26 * scale, borderRadius: 13 * scale, marginRight: 10 * scale }]}>
                                    <Ionicons name="lock-closed-outline" size={14 * scale} color="#334155" />
                                </View>
                                <Text style={[s.securityFooterText, { fontSize: 10 * scale, lineHeight: 14 * scale, textAlign: isSmall ? 'center' : 'left' }]}>
                                    Your security is our priority.{"\n"}All transactions are protected{"\n"}with advanced encryption.
                                </Text>
                            </View>
 
                            {/* Real Partner Logos */}
                            <View style={[s.partnersRow, isSmall && { justifyContent: 'center', width: '100%', marginTop: 8 }]}>
                                <Image source={require('../../assets/images/mtn.png')} style={[s.partnerLogo, { width: 36 * scale, height: 20 * scale }]} resizeMode="contain" />
                                <Image source={require('../../assets/images/airtel.png')} style={[s.partnerLogo, { width: 44 * scale, height: 20 * scale }]} resizeMode="contain" />
                                <Image source={require('../../assets/images/glo.png')} style={[s.partnerLogo, { width: 28 * scale, height: 28 * scale }]} resizeMode="contain" />
                                <Image source={require('../../assets/images/9mobile.png')} style={[s.partnerLogo, { width: 28 * scale, height: 28 * scale }]} resizeMode="contain" />
                                <View style={[s.aedcWrapper, { marginLeft: 6 * scale }]}>
                                    <Ionicons name="flash" size={14 * scale} color="#eab308" style={{ marginRight: 2 * scale }} />
                                    <Text style={[s.aedcText, { fontSize: 13 * scale }]}>AEDC</Text>
                                </View>
                            </View>
                        </View>
                        
                        <Text style={[s.copyrightText, { marginTop: spacing.copyrightMarginTop, fontSize: 13 * scale }]}>© {new Date().getFullYear()} Mafhal Sub. All rights reserved. | CAC: 89799349</Text>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    scrollContainer: {
        flexGrow: 1,
        paddingTop: 16,
        paddingBottom: 32,
        maxWidth: 1200,
        alignSelf: 'center',
        width: '100%',
    },
    topNav: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 28,
    },
    brandLogoRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    brandLogo: {
        width: 36,
        height: 36,
    },
    brandText: {
        fontSize: 13,
        fontWeight: '900',
        color: '#0f172a',
        lineHeight: 14,
    },
    brandSubtext: {
        fontSize: 9,
        fontWeight: '800',
        color: '#d97706',
        lineHeight: 10,
    },
    langSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 16,
        paddingHorizontal: 10,
        paddingVertical: 5,
        backgroundColor: '#ffffff',
    },
    langText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#0f172a',
    },
    bodyRow: {
        flexDirection: 'row',
        width: '100%',
        maxWidth: 1200,
        alignSelf: 'center',
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    bodyColumn: {
        flexDirection: 'column',
        width: '100%',
        alignItems: 'center',
    },
    heroLeft: {
        flex: 0.8,
        alignItems: 'flex-start',
    },
    heroCenter: {
        width: '100%',
        alignItems: 'center',
    },
    cardRight: {
        flex: 1.6,
        alignItems: 'flex-start',
    },
    cardCenter: {
        width: '100%',
        alignItems: 'center',
    },
    oneSubTextLeft: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginTop: 4,
        textAlign: 'left',
    },
    welcomeTextContainer: {
        position: 'relative',
        marginBottom: 4,
    },
    welcomeMain: {
        fontSize: 32,
        fontWeight: '900',
        color: '#0a192f',
    },
    welcomeHighlight: {
        fontSize: 32,
        fontWeight: '900',
        color: '#d97706',
        marginTop: -4,
    },
    yellowUnderline: {
        width: 48,
        height: 3,
        backgroundColor: '#eab308',
        borderRadius: 1.5,
        marginTop: 2,
    },
    heroSubtext: {
        fontSize: 12,
        color: '#64748b',
        lineHeight: 16,
        marginBottom: 16,
        maxWidth: 320,
    },
    podiumWrapper: {
        width: '120%',
        marginLeft: '-10%',
        marginTop: 20,
        aspectRatio: 0.7,
        maxHeight: 600,
        alignItems: 'center',
        justifyContent: 'center',
    },
    podiumImage: {
        width: '100%',
        height: '100%',
        transform: [{ scale: 1.5 }, { translateX: 0 }],
    },
    bottomBlur: {
        position: 'absolute',
        bottom: -10,
        left: -40,
        right: -40,
        height: 80,
    },
    loginCard: {
        width: '100%',
        maxWidth: 500,
        backgroundColor: '#ffffff',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#0a1633',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 20,
        elevation: 3,
        alignItems: 'center',
        position: 'relative',
    },
    userIconCircle: {
        position: 'absolute',
        top: -24,
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#eff6ff',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 4,
        borderColor: '#ffffff',
        shadowColor: '#0a1633',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    cardTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: 4,
        textAlign: 'center',
    },
    cardSubtitle: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '500',
        marginBottom: 18,
        textAlign: 'center',
    },
    inputContainer: {
        width: '100%',
        marginBottom: 12,
    },
    inputLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 6,
        marginLeft: 2,
    },
    inputBox: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 46,
        backgroundColor: '#ffffff',
    },
    inputIcon: {
        marginRight: 8,
    },
    textInput: {
        flex: 1,
        color: '#0f172a',
        fontSize: 13,
        fontWeight: '600',
    },
    forgotLink: {
        alignSelf: 'flex-end',
        marginTop: 6,
    },
    forgotText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#0056D2',
    },
    loginButton: {
        width: '100%',
        marginTop: 8,
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: '#d97706',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 3,
    },
    loginButtonGradient: {
        height: 46,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonInner: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    loginButtonText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '800',
    },
    buttonArrow: {
        position: 'absolute',
        right: 16,
    },
    orSeparatorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        marginVertical: 14,
    },
    separatorLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#e2e8f0',
    },
    orText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#94a3b8',
        marginHorizontal: 12,
    },
    googleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: 44,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        backgroundColor: '#ffffff',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.02,
        shadowRadius: 3,
        elevation: 1,
    },
    googleButtonText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#334155',
    },
    signupFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 18,
    },
    signupFooterNormal: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '500',
    },
    signupFooterLink: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0056D2',
    },
    featuresRow: {
        flexDirection: 'row',
        minWidth: '100%',
        backgroundColor: '#ffffff',
        borderRadius: 20,
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.02,
        shadowRadius: 8,
        elevation: 2,
        marginBottom: 20,
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    featureCard: {
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        paddingHorizontal: 2,
    },
    verticalDivider: {
        width: 1,
        height: 36,
        backgroundColor: '#e2e8f0',
    },
    featureIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
    },
    featureTitle: {
        fontSize: 11,
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: 2,
        textAlign: 'center',
    },
    featureDesc: {
        fontSize: 8,
        color: '#64748b',
        fontWeight: '500',
        textAlign: 'center',
        lineHeight: 11,
    },
    securityPartnersCard: {
        flexDirection: 'row',
        width: '100%',
        backgroundColor: '#ffffff',
        borderRadius: 20,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.02,
        shadowRadius: 8,
        elevation: 2,
        marginBottom: 20,
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    securityFooterLeft: {
        flex: 1.2,
        flexDirection: 'row',
        alignItems: 'center',
    },
    securityFooterIconCircle: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    securityFooterText: {
        flex: 1,
        fontSize: 8.5,
        color: '#64748b',
        fontWeight: '500',
        lineHeight: 12,
    },
    verticalDividerPartners: {
        width: 1,
        height: 32,
        backgroundColor: '#e2e8f0',
        marginHorizontal: 12,
    },
    partnersRow: {
        flex: 1.1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 4,
    },
    partnerLogo: {
        width: 24,
        height: 24,
    },
    aedcWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    aedcText: {
        fontSize: 10,
        fontWeight: '900',
        color: '#0056D2',
    },
    copyrightText: {
        fontSize: 9,
        color: '#94a3b8',
        fontWeight: '600',
        textAlign: 'center',
        marginTop: 8,
    },
});

