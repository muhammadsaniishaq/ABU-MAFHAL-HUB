import { View, Text, StyleSheet, useWindowDimensions, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Image, ScrollView, Alert, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export default function Signup() {
    const [fullName, setFullName] = useState('');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [referralCode, setReferralCode] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingGoogle, setLoadingGoogle] = useState(false);

    // Validation States
    const [checkingUsername, setCheckingUsername] = useState(false);
    const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
    const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);

    const [checkingEmail, setCheckingEmail] = useState(false);
    const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);

    const [checkingPhone, setCheckingPhone] = useState(false);
    const [phoneAvailable, setPhoneAvailable] = useState<boolean | null>(null);

    const router = useRouter();

    // Real-time Username Check
    useEffect(() => {
        const checkUsername = async () => {
            if (username.length < 3) {
                setUsernameAvailable(null);
                setUsernameSuggestions([]);
                return;
            }
            setCheckingUsername(true);
            try {
                const { data, error } = await supabase.functions.invoke('check-availability', {
                    body: { field: 'username', value: username }
                });

                if (error) throw error;

                if (data.available) {
                    setUsernameAvailable(true);
                    setUsernameSuggestions([]);
                } else {
                    setUsernameAvailable(false);
                    setUsernameSuggestions(data.suggestions || []);
                }
            } catch (error) {
                console.log('Username check error', error);
                // Fallback or ignore error
            } finally {
                setCheckingUsername(false);
            }
        };
        const timer = setTimeout(checkUsername, 600);
        return () => clearTimeout(timer);
    }, [username]);

    // Real-time Email Check
    useEffect(() => {
        const checkEmail = async () => {
            if (!email.includes('@')) {
                setEmailAvailable(null);
                return;
            }
            setCheckingEmail(true);
            try {
                const { data, error } = await supabase.functions.invoke('check-availability', {
                    body: { field: 'email', value: email }
                });
                if (error) throw error;
                setEmailAvailable(data.available);
            } catch (error) {
                console.log('Email check error', error);
            } finally {
                setCheckingEmail(false);
            }
        };
        const timer = setTimeout(checkEmail, 600);
        return () => clearTimeout(timer);
    }, [email]);

    // Real-time Phone Check
    useEffect(() => {
        const checkPhone = async () => {
            if (phone.length < 10) {
                setPhoneAvailable(null);
                return;
            }
            setCheckingPhone(true);
            try {
                const { data, error } = await supabase.functions.invoke('check-availability', {
                    body: { field: 'phone', value: phone }
                });
                if (error) throw error;
                setPhoneAvailable(data.available);
            } catch (error) {
                console.log('Phone check error', error);
            } finally {
                setCheckingPhone(false);
            }
        };
        const timer = setTimeout(checkPhone, 600);
        return () => clearTimeout(timer);
    }, [phone]);

    const handleGoogleLogin = async () => {
        if (loadingGoogle) return;
        setLoadingGoogle(true);
        console.log('Google login clicked');
        try {
            const redirectTo = Platform.OS === 'web' ? window.location.origin : undefined;
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo
                }
            });
            if (error) throw error;
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

    const handleSignup = async () => {
        if (!fullName || !username || !email || !phone || !password) {
            Alert.alert('Error', 'Please fill in all required fields');
            return;
        }

        if (usernameAvailable === false || emailAvailable === false || phoneAvailable === false) {
            Alert.alert('Error', 'Please resolve the availability errors before proceeding.');
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                        username: username,
                        phone: phone,
                        referral_code: referralCode,
                    }
                }
            });

            if (error) throw error;

            Alert.alert('Success', 'Account created! Please check your email to verify.');
            router.replace('/(auth)/login');
        } catch (error: any) {
            Alert.alert('Signup Error', error.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    // Layout Constants
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
                        scrollEnabled={height < 900}
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
                                        <Text style={s.brandSubtext}>HUB</Text>
                                    </View>
                                </View>
                                <Text style={s.oneHubTextLeft}>One Hub. Endless Possibilities.</Text>
                            </View>

                            <TouchableOpacity 
                                onPress={() => {
                                    if (router.canGoBack()) {
                                        router.back();
                                    } else {
                                        router.replace('/(auth)/login');
                                    }
                                }}
                                style={s.langSelector}
                            >
                                <Ionicons name="arrow-back" size={14} color="#0f172a" style={{ marginRight: 6 }} />
                                <Text style={s.langText}>Back</Text>
                            </TouchableOpacity>
                        </View>

                        {/* RESPONSIVE BODY SECTION - ALWAYS SIDE-BY-SIDE */}
                        <View style={[s.bodyRow, { marginBottom: spacing.bodyMargin, gap: bodyGap }]}>
                            
                            {/* LEFT SIDE: HERO PRESENTATION */}
                            <View style={s.heroLeft}>
                                <View style={s.welcomeTextContainer}>
                                    <Text style={[s.welcomeMain, { fontSize: 36 * scale }]}>Create</Text>
                                    <Text style={[s.welcomeHighlight, { fontSize: 36 * scale }]}>Account</Text>
                                    <View style={[s.yellowUnderline, { width: 56 * scale, marginTop: 4 * scale }]} />
                                </View>

                                <Text style={[s.heroSubtext, { fontSize: 13 * scale, marginTop: 12 * scale, marginBottom: 12 * scale }]}>
                                    Join the future of finance today.
                                </Text>

                                <View style={s.podiumWrapper}>
                                    <Image
                                        source={require('../../assets/images/ceo.jpg')}
                                        style={s.podiumImage}
                                        resizeMode="cover"
                                    />
                                    <LinearGradient
                                        colors={['rgba(248, 250, 252, 0)', 'rgba(248, 250, 252, 0.8)', 'rgba(248, 250, 252, 1)']}
                                        style={s.bottomBlur}
                                        pointerEvents="none"
                                    />
                                </View>
                            </View>

                            {/* RIGHT SIDE: SIGNUP CARD */}
                            <View style={s.cardRight}>
                                <View style={[
                                    s.loginCard,
                                    {
                                        marginTop: 80 * scale,
                                        paddingTop: spacing.cardPaddingTop,
                                        paddingBottom: spacing.cardPaddingBottom,
                                        paddingHorizontal: spacing.cardPaddingHorizontal,
                                    }
                                ]}>
                                    <View style={[s.userIconCircle, { width: 56 * scale, height: 56 * scale, borderRadius: 28 * scale, top: -28 * scale }]}>
                                        <Ionicons name="person-add" size={24 * scale} color="#0056D2" />
                                    </View>

                                    <Text style={[s.cardTitle, { fontSize: 24 * scale }]}>
                                        Join <Text style={{ color: '#d97706' }}>Mafhal Hub</Text>
                                    </Text>
                                    <Text style={[s.cardSubtitle, { fontSize: 12 * scale, marginBottom: 20 * scale }]}>Enter your details to get started</Text>

                                    {/* Input: Full Name */}
                                    <View style={[s.inputContainer, { marginBottom: spacing.inputMargin }]}>
                                        <Text style={[s.inputLabel, { fontSize: 12 * scale }]}>Full Name</Text>
                                        <View style={[s.inputBox, { height: 46 * scale, borderRadius: 12 * scale, paddingHorizontal: 12 * scale }]}>
                                            <Ionicons name="person-outline" size={18 * scale} color="#94a3b8" style={s.inputIcon} />
                                            <TextInput
                                                style={[s.textInput, { fontSize: 13 * scale }]}
                                                placeholder="Enter full name"
                                                placeholderTextColor="#94a3b8"
                                                value={fullName}
                                                onChangeText={setFullName}
                                                selectionColor="#0056D2"
                                            />
                                        </View>
                                    </View>

                                    {/* Input: Username */}
                                    <View style={[s.inputContainer, { marginBottom: spacing.inputMargin }]}>
                                        <Text style={[s.inputLabel, { fontSize: 12 * scale }]}>Username</Text>
                                        <View style={[s.inputBox, { height: 46 * scale, borderRadius: 12 * scale, paddingHorizontal: 12 * scale }, 
                                            usernameAvailable === false ? { borderColor: '#fca5a5', backgroundColor: '#fef2f2', borderWidth: 1 } : 
                                            usernameAvailable === true ? { borderColor: '#86efac', backgroundColor: '#f0fdf4', borderWidth: 1 } : {}
                                        ]}>
                                            <Ionicons name="at-outline" size={18 * scale} color="#94a3b8" style={s.inputIcon} />
                                            <TextInput
                                                style={[s.textInput, { fontSize: 13 * scale }]}
                                                placeholder="Choose a username"
                                                placeholderTextColor="#94a3b8"
                                                value={username}
                                                onChangeText={setUsername}
                                                autoCapitalize="none"
                                                selectionColor="#0056D2"
                                            />
                                            {checkingUsername ? (
                                                <ActivityIndicator size="small" color="#0056D2" />
                                            ) : usernameAvailable === true ? (
                                                <Ionicons name="checkmark-circle" size={18 * scale} color="#10B981" />
                                            ) : usernameAvailable === false ? (
                                                <Ionicons name="close-circle" size={18 * scale} color="#EF4444" />
                                            ) : null}
                                        </View>
                                        {usernameAvailable === false && (
                                            <View style={{ marginTop: 8 }}>
                                                <Text style={{ color: '#ef4444', fontSize: 10 * scale, marginLeft: 4, marginBottom: 4 }}>Username is taken. Try these:</Text>
                                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                                    {usernameSuggestions.map((suggestion, index) => (
                                                        <TouchableOpacity 
                                                            key={index}
                                                            onPress={() => setUsername(suggestion)}
                                                            style={{ backgroundColor: '#eff6ff', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#dbeafe' }}
                                                        >
                                                            <Text style={{ color: '#2563eb', fontSize: 10 * scale, fontWeight: '700' }}>{suggestion}</Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                            </View>
                                        )}
                                    </View>

                                    {/* Input: Email */}
                                    <View style={[s.inputContainer, { marginBottom: spacing.inputMargin }]}>
                                        <Text style={[s.inputLabel, { fontSize: 12 * scale }]}>Email Address</Text>
                                        <View style={[s.inputBox, { height: 46 * scale, borderRadius: 12 * scale, paddingHorizontal: 12 * scale },
                                            emailAvailable === false ? { borderColor: '#fca5a5', backgroundColor: '#fef2f2', borderWidth: 1 } : 
                                            emailAvailable === true ? { borderColor: '#86efac', backgroundColor: '#f0fdf4', borderWidth: 1 } : {}
                                        ]}>
                                            <Ionicons name="mail-outline" size={18 * scale} color="#94a3b8" style={s.inputIcon} />
                                            <TextInput
                                                style={[s.textInput, { fontSize: 13 * scale }]}
                                                placeholder="Enter your email"
                                                placeholderTextColor="#94a3b8"
                                                value={email}
                                                onChangeText={setEmail}
                                                autoCapitalize="none"
                                                keyboardType="email-address"
                                                selectionColor="#0056D2"
                                            />
                                            {checkingEmail ? (
                                                <ActivityIndicator size="small" color="#0056D2" />
                                            ) : emailAvailable === true ? (
                                                <Ionicons name="checkmark-circle" size={18 * scale} color="#10B981" />
                                            ) : emailAvailable === false ? (
                                                <Ionicons name="close-circle" size={18 * scale} color="#EF4444" />
                                            ) : null}
                                        </View>
                                        {emailAvailable === false && (
                                             <Text style={{ color: '#ef4444', fontSize: 10 * scale, marginLeft: 4, marginTop: 4 }}>Email already registered</Text>
                                        )}
                                    </View>

                                    {/* Input: Phone */}
                                    <View style={[s.inputContainer, { marginBottom: spacing.inputMargin }]}>
                                        <Text style={[s.inputLabel, { fontSize: 12 * scale }]}>Phone Number</Text>
                                        <View style={[s.inputBox, { height: 46 * scale, borderRadius: 12 * scale, paddingHorizontal: 12 * scale },
                                            phoneAvailable === false ? { borderColor: '#fca5a5', backgroundColor: '#fef2f2', borderWidth: 1 } : 
                                            phoneAvailable === true ? { borderColor: '#86efac', backgroundColor: '#f0fdf4', borderWidth: 1 } : {}
                                        ]}>
                                            <Ionicons name="call-outline" size={18 * scale} color="#94a3b8" style={s.inputIcon} />
                                            <TextInput
                                                style={[s.textInput, { fontSize: 13 * scale }]}
                                                placeholder="Enter phone number"
                                                placeholderTextColor="#94a3b8"
                                                value={phone}
                                                onChangeText={setPhone}
                                                keyboardType="phone-pad"
                                                selectionColor="#0056D2"
                                            />
                                             {checkingPhone ? (
                                                <ActivityIndicator size="small" color="#0056D2" />
                                            ) : phoneAvailable === true ? (
                                                <Ionicons name="checkmark-circle" size={18 * scale} color="#10B981" />
                                            ) : phoneAvailable === false ? (
                                                <Ionicons name="close-circle" size={18 * scale} color="#EF4444" />
                                            ) : null}
                                        </View>
                                        {phoneAvailable === false && (
                                             <Text style={{ color: '#ef4444', fontSize: 10 * scale, marginLeft: 4, marginTop: 4 }}>Phone number already in use</Text>
                                        )}
                                    </View>

                                    {/* Input: Password */}
                                    <View style={[s.inputContainer, { marginBottom: spacing.inputMargin }]}>
                                        <Text style={[s.inputLabel, { fontSize: 12 * scale }]}>Password</Text>
                                        <View style={[s.inputBox, { height: 46 * scale, borderRadius: 12 * scale, paddingHorizontal: 12 * scale }]}>
                                            <Ionicons name="lock-closed-outline" size={18 * scale} color="#94a3b8" style={s.inputIcon} />
                                            <TextInput
                                                style={[s.textInput, { fontSize: 13 * scale }]}
                                                placeholder="Create a password"
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
                                    </View>

                                    {/* Input: Referral Code */}
                                    <View style={[s.inputContainer, { marginBottom: spacing.inputMargin }]}>
                                        <Text style={[s.inputLabel, { fontSize: 12 * scale }]}>Referral Code (Optional)</Text>
                                        <View style={[s.inputBox, { height: 46 * scale, borderRadius: 12 * scale, paddingHorizontal: 12 * scale }]}>
                                            <Ionicons name="gift-outline" size={18 * scale} color="#94a3b8" style={s.inputIcon} />
                                            <TextInput
                                                style={[s.textInput, { fontSize: 13 * scale }]}
                                                placeholder="e.g. johndoe123"
                                                placeholderTextColor="#94a3b8"
                                                value={referralCode}
                                                onChangeText={setReferralCode}
                                                autoCapitalize="none"
                                                selectionColor="#0056D2"
                                            />
                                        </View>
                                    </View>

                                    {/* Signup Button */}
                                    <TouchableOpacity
                                        onPress={handleSignup}
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
                                                    <Text style={[s.loginButtonText, { fontSize: 15 * scale }]}>Create Account</Text>
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

                                    {/* Login Link */}
                                    <View style={[s.signupFooter, { marginTop: 20 * scale }]}>
                                        <Text style={[s.signupFooterNormal, { fontSize: 13 * scale }]}>Already have an account? </Text>
                                        <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                                            <Text style={[s.signupFooterLink, { fontSize: 13 * scale }]}>Sign In</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        </View>
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
    oneHubTextLeft: {
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

