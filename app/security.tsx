import { View, Text, TouchableOpacity, Switch, Alert } from 'react-native';
import { useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

export default function SecurityScreen() {
    const [biometricEnabled, setBiometricEnabled] = useState(false);
    const router = useRouter();

    const handleBiometricToggle = (value: boolean) => {
        setBiometricEnabled(value);
        if (value) {
            Alert.alert("Biometrics Enabled", "You can now use FaceID/TouchID to login.");
        }
    };

    return (
        <View className="flex-1 bg-gray-50">
            <Stack.Screen options={{ title: 'Security', headerTintColor: '#0056D2' }} />
            <StatusBar style="dark" />

            <View className="px-6 pt-6">
                <View className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <TouchableOpacity
                        className="flex-row items-center justify-between p-4 border-b border-gray-100"
                        onPress={() => router.push('/(auth)/pin-setup')}
                    >
                        <View className="flex-row items-center">
                            <View className="w-10 h-10 rounded-full bg-blue-50 items-center justify-center mr-3">
                                <Ionicons name="keypad" size={20} color="#0056D2" />
                            </View>
                            <Text className="text-slate font-medium text-base">Change PIN</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        className="flex-row items-center justify-between p-4"
                        onPress={() => router.push('/(auth)/pin-setup')} // Should link to password change
                    >
                        <View className="flex-row items-center">
                            <View className="w-10 h-10 rounded-full bg-blue-50 items-center justify-center mr-3">
                                <Ionicons name="lock-closed" size={20} color="#0056D2" />
                            </View>
                            <Text className="text-slate font-medium text-base">Change Password</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                    </TouchableOpacity>
                </View>

                <View className="mt-6 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <View className="flex-row items-center justify-between p-4">
                        <View className="flex-row items-center">
                            <View className="w-10 h-10 rounded-full bg-purple-50 items-center justify-center mr-3">
                                <Ionicons name="finger-print" size={20} color="#9333EA" />
                            </View>
                            <View>
                                <Text className="text-slate font-medium text-base">Biometric Login</Text>
                                <Text className="text-xs text-gray-400">FaceID / TouchID</Text>
                            </View>
                        </View>
                        <Switch
                            trackColor={{ false: '#E5E7EB', true: '#0056D2' }}
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
