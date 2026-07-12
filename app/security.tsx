import { View, Text, TouchableOpacity, Switch, Alert, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

export default function SecurityScreen() {
    const [biometricEnabled, setBiometricEnabled] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const bioEnabled = await AsyncStorage.getItem('biometrics_setup_completed');
                setBiometricEnabled(bioEnabled === 'true');
            } catch (e) {
                console.error("Failed to load security settings:", e);
            }
        };
        loadSettings();
    }, []);

    const handleBiometricToggle = async (value: boolean) => {
        if (value) {
            // Trigger biometrics challenge to verify setup
            try {
                const hasHardware = await LocalAuthentication.hasHardwareAsync();
                const isEnrolled = await LocalAuthentication.isEnrolledAsync();

                if (!hasHardware || !isEnrolled) {
                    Alert.alert(
                        "Not Supported", 
                        "Biometric authentication is not supported or set up on this device."
                    );
                    return;
                }

                const result = await LocalAuthentication.authenticateAsync({
                    promptMessage: 'Confirm Biometric Setup',
                    fallbackLabel: 'Use passcode',
                });

                if (result.success) {
                    await AsyncStorage.setItem('biometrics_setup_completed', 'true');
                    setBiometricEnabled(true);
                    Alert.alert("Success", "Biometric login enabled.");
                } else {
                    setBiometricEnabled(false);
                }
            } catch (e) {
                Alert.alert("Error", "Biometric setup failed.");
                setBiometricEnabled(false);
            }
        } else {
            await AsyncStorage.setItem('biometrics_setup_completed', 'false');
            setBiometricEnabled(false);
            Alert.alert("Disabled", "Biometric login disabled.");
        }
    };

    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            {/* HEADER */}
            <View className="bg-[#0d1b3e] pt-12 pb-5 px-6 border-b border-[#0d1b3e] shadow-sm flex-row items-center justify-between">
                <TouchableOpacity onPress={() => router.back()} className="p-2 bg-white/10 rounded-full border border-white/20">
                    <Ionicons name="arrow-back" size={20} color="#ffffff" />
                </TouchableOpacity>
                <Text className="text-lg font-black text-white tracking-wide">Security</Text>
                <View className="w-10" />
            </View>

            <View className="px-6 pt-6">
                <Text className="text-[#0d1b3e] font-black tracking-widest text-[10px] uppercase mb-3 ml-1">Access Credentials</Text>
                <View className="bg-white rounded-2xl shadow-sm shadow-[#0d1b3e]/10 border border-[#0d1b3e]/10 overflow-hidden">
                    <TouchableOpacity
                        className="flex-row items-center justify-between p-4 border-b border-[#0d1b3e]/5"
                        onPress={() => router.push('/(auth)/pin-setup')}
                    >
                        <View className="flex-row items-center">
                            <View className="w-8 h-8 rounded-md bg-[#0d1b3e]/5 items-center justify-center mr-3">
                                <Ionicons name="keypad" size={16} color="#f5a623" />
                            </View>
                            <Text className="text-[#0d1b3e] font-bold text-xs">Change PIN</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#0d1b3e" style={{opacity: 0.3}} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        className="flex-row items-center justify-between p-4"
                        onPress={() => router.push('/(auth)/pin-setup')} // Should link to password change
                    >
                        <View className="flex-row items-center">
                            <View className="w-8 h-8 rounded-md bg-[#0d1b3e]/5 items-center justify-center mr-3">
                                <Ionicons name="lock-closed" size={16} color="#f5a623" />
                            </View>
                            <Text className="text-[#0d1b3e] font-bold text-xs">Change Password</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#0d1b3e" style={{opacity: 0.3}} />
                    </TouchableOpacity>
                </View>

                <Text className="text-[#0d1b3e] font-black tracking-widest text-[10px] uppercase mt-8 mb-3 ml-1">Device Security</Text>
                <View className="bg-white rounded-2xl shadow-sm shadow-[#0d1b3e]/10 border border-[#0d1b3e]/10 overflow-hidden">
                    <View className="flex-row items-center justify-between p-4">
                        <View className="flex-row items-center">
                            <View className="w-8 h-8 rounded-md bg-[#0d1b3e]/5 items-center justify-center mr-3">
                                <Ionicons name="finger-print" size={16} color="#f5a623" />
                            </View>
                            <View>
                                <Text className="text-[#0d1b3e] font-bold text-xs">Biometric Login</Text>
                                <Text className="text-[10px] text-slate-400 font-medium mt-0.5">FaceID / TouchID</Text>
                            </View>
                        </View>
                        <Switch
                            trackColor={{ false: '#e2e8f0', true: '#0d1b3e' }}
                            thumbColor={biometricEnabled ? '#f5a623' : '#ffffff'}
                            onValueChange={handleBiometricToggle}
                            value={biometricEnabled}
                            style={{ transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }] }}
                        />
                    </View>
                </View>
            </View>
        </View>
    );
}
