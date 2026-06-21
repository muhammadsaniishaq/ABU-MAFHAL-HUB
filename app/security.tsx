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
            <Stack.Screen options={{ title: 'Security', headerTintColor: '#0d1b3e', headerTitleStyle: { fontWeight: 'bold' } }} />
            <StatusBar style="dark" />

            <View className="px-6 pt-6">
                <View className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                    <TouchableOpacity
                        className="flex-row items-center justify-between p-4 border-b border-slate-100"
                        onPress={() => router.push('/(auth)/pin-setup')}
                    >
                        <View className="flex-row items-center">
                            <View className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center mr-3">
                                <Ionicons name="keypad" size={20} color="#0d1b3e" />
                            </View>
                            <Text className="text-slate-800 font-semibold text-base">Change PIN</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        className="flex-row items-center justify-between p-4"
                        onPress={() => router.push('/(auth)/pin-setup')} // Should link to password change
                    >
                        <View className="flex-row items-center">
                            <View className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center mr-3">
                                <Ionicons name="lock-closed" size={20} color="#0d1b3e" />
                            </View>
                            <Text className="text-slate-800 font-semibold text-base">Change Password</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                    </TouchableOpacity>
                </View>

                <View className="mt-6 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                    <View className="flex-row items-center justify-between p-4">
                        <View className="flex-row items-center">
                            <View className="w-10 h-10 rounded-full bg-[#f5a623]/10 items-center justify-center mr-3">
                                <Ionicons name="finger-print" size={20} color="#f5a623" />
                            </View>
                            <View>
                                <Text className="text-slate-800 font-semibold text-base">Biometric Login</Text>
                                <Text className="text-xs text-slate-400">FaceID / TouchID</Text>
                            </View>
                        </View>
                        <Switch
                            trackColor={{ false: '#E2E8F0', true: '#0d1b3e' }}
                            thumbColor={'#ffffff'}
                            onValueChange={handleBiometricToggle}
                            value={biometricEnabled}
                        />
                    </View>
                </View>
            </View>
        </View>
    );
}
