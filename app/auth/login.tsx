import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';

export default function Login() {
    const { ref } = useLocalSearchParams<{ ref?: string }>(); // Capture ?ref=CODE from URL deep link
    
    const [isRegistering, setIsRegistering] = useState(false);
    
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [username, setUsername] = useState('');
    const [phone, setPhone] = useState('');
    const [referralCode, setReferralCode] = useState('');
    
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    // Auto-fill referral code and switch to register mode if deep linked!
    useEffect(() => {
        if (ref) {
            setReferralCode(ref);
            setIsRegistering(true);
        }
    }, [ref]);

    const handleAuth = async () => {
        setLoading(true);
        
        if (isRegistering) {
            // Validation
            if (!email || !password || !fullName || !username || !phone) {
                Alert.alert('Error', 'Please fill in all required fields.');
                setLoading(false);
                return;
            }

            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                        username: username.toLowerCase().replace(/\s/g, ''), // Ensure no spaces
                        phone: phone,
                        referral_code: referralCode, // Trigger will use this to set referrer_id
                    }
                }
            });

            if (error) {
                Alert.alert('Registration Failed', error.message);
            } else {
                Alert.alert('Success!', 'Account created successfully. Please check your email to verify.');
                setIsRegistering(false); // Switch back to login
            }
        } else {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                Alert.alert('Login Failed', error.message);
            }
        }
        setLoading(false);
    };

    return (
        <ScrollView className="flex-1 bg-slate-950" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
            <Stack.Screen options={{ headerShown: false }} />

            <View className="mb-8 mt-10">
                <Text className="text-indigo-500 font-bold uppercase tracking-widest text-xs mb-2">Abu Mafhal Sub</Text>
                <Text className="text-white font-black text-4xl">
                    {isRegistering ? 'Create Account.' : 'Welcome Back.'}
                </Text>
                <Text className="text-slate-500 mt-2">
                    {isRegistering ? 'Sign up to start enjoying cheap data and rewards.' : 'Sign in to access the command center.'}
                </Text>
            </View>

            <View className="gap-4">
                {isRegistering && (
                    <>
                        <View className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                            <Text className="text-slate-500 text-[10px] uppercase font-bold mb-1">Full Name</Text>
                            <TextInput
                                className="text-white font-medium text-base"
                                placeholder="Umar Faruk"
                                placeholderTextColor="#475569"
                                value={fullName}
                                onChangeText={setFullName}
                            />
                        </View>
                        <View className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                            <Text className="text-slate-500 text-[10px] uppercase font-bold mb-1">Username (Used as your Referral Code)</Text>
                            <TextInput
                                className="text-white font-medium text-base"
                                placeholder="umar123"
                                placeholderTextColor="#475569"
                                autoCapitalize="none"
                                value={username}
                                onChangeText={setUsername}
                            />
                        </View>
                        <View className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                            <Text className="text-slate-500 text-[10px] uppercase font-bold mb-1">Phone Number</Text>
                            <TextInput
                                className="text-white font-medium text-base"
                                placeholder="08012345678"
                                placeholderTextColor="#475569"
                                keyboardType="phone-pad"
                                value={phone}
                                onChangeText={setPhone}
                            />
                        </View>
                    </>
                )}

                <View className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                    <Text className="text-slate-500 text-[10px] uppercase font-bold mb-1">Email Address</Text>
                    <TextInput
                        className="text-white font-medium text-base"
                        placeholder="user@abumafhal.com.ng"
                        placeholderTextColor="#475569"
                        autoCapitalize="none"
                        value={email}
                        onChangeText={setEmail}
                    />
                </View>

                <View className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                    <Text className="text-slate-500 text-[10px] uppercase font-bold mb-1">Password</Text>
                    <TextInput
                        className="text-white font-medium text-base"
                        placeholder="••••••••"
                        placeholderTextColor="#475569"
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                    />
                </View>

                {isRegistering && (
                    <View className="bg-slate-900 border border-indigo-500/30 rounded-xl px-4 py-3 mb-2">
                        <Text className="text-indigo-400 text-[10px] uppercase font-bold mb-1">Referral Code (Optional)</Text>
                        <TextInput
                            className="text-white font-medium text-base"
                            placeholder="Enter friend's code"
                            placeholderTextColor="#475569"
                            autoCapitalize="none"
                            value={referralCode}
                            onChangeText={setReferralCode}
                        />
                    </View>
                )}

                <TouchableOpacity
                    onPress={handleAuth}
                    disabled={loading}
                    className="overflow-hidden rounded-xl mt-2"
                >
                    <LinearGradient
                        colors={['#4F46E5', '#4338ca']}
                        className="py-4 items-center justify-center"
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text className="text-white font-bold text-lg">{isRegistering ? 'Create Account' : 'Enter Console'}</Text>
                        )}
                    </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity 
                    onPress={() => setIsRegistering(!isRegistering)} 
                    className="py-4 items-center mb-10"
                >
                    <Text className="text-slate-500 font-medium">
                        {isRegistering ? 'Already have an account? Sign in' : 'Create new account'}
                    </Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}
