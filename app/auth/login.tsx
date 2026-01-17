import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { supabase } from '../../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async () => {
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            Alert.alert('Login Failed', error.message);
            setLoading(false);
        } else {
            // Auth State Change in _layout will handle navigation
            // But we can force it too
            // router.replace('/admin');
        }
    };

    const handleSignUp = async () => {
        setLoading(true);
        const { error } = await supabase.auth.signUp({
            email,
            password,
        });

        if (error) {
            Alert.alert('Registration Failed', error.message);
        } else {
            Alert.alert('Check your email', 'We sent you a confirmation link.');
        }
        setLoading(false);
    };

    return (
        <View className="flex-1 bg-slate-950 justify-center p-6">
            <Stack.Screen options={{ headerShown: false }} />

            <View className="mb-12">
                <Text className="text-indigo-500 font-bold uppercase tracking-widest text-xs mb-2">Abu Mafhal Hub</Text>
                <Text className="text-white font-black text-4xl">Welcome Back.</Text>
                <Text className="text-slate-500 mt-2">Sign in to access the command center.</Text>
            </View>

            <View className="gap-4">
                <View className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                    <Text className="text-slate-500 text-[10px] uppercase font-bold mb-1">Email Address</Text>
                    <TextInput
                        className="text-white font-medium text-base"
                        placeholder="admin@abumafhal.com"
                        placeholderTextColor="#475569"
                        autoCapitalize="none"
                        value={email}
                        onChangeText={setEmail}
                    />
                </View>

                <View className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 mb-4">
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

                <TouchableOpacity
                    onPress={handleLogin}
                    disabled={loading}
                    className="overflow-hidden rounded-xl"
                >
                    <LinearGradient
                        colors={['#4F46E5', '#4338ca']}
                        className="py-4 items-center justify-center"
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text className="text-white font-bold text-lg">Enter Console</Text>
                        )}
                    </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleSignUp} className="py-4 items-center">
                    <Text className="text-slate-500 font-medium">Create new account</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
