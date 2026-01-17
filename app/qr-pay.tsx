import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';

export default function QRPayScreen() {
    const [activeTab, setActiveTab] = useState<'scan' | 'mycode'>('scan');

    return (
        <View className="flex-1 bg-white">
            <Stack.Screen options={{ title: 'QR Pay', headerTintColor: '#0056D2' }} />
            <StatusBar style="dark" />

            {/* Tab Switcher */}
            <View className="flex-row pt-4 px-6 bg-white border-b border-gray-100">
                <TouchableOpacity
                    className={`flex-1 py-3 items-center border-b-2 ${activeTab === 'scan' ? 'border-primary' : 'border-transparent'}`}
                    onPress={() => setActiveTab('scan')}
                >
                    <Text className={`font-bold ${activeTab === 'scan' ? 'text-primary' : 'text-gray-400'}`}>Scan Code</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    className={`flex-1 py-3 items-center border-b-2 ${activeTab === 'mycode' ? 'border-primary' : 'border-transparent'}`}
                    onPress={() => setActiveTab('mycode')}
                >
                    <Text className={`font-bold ${activeTab === 'mycode' ? 'text-primary' : 'text-gray-400'}`}>My QR Code</Text>
                </TouchableOpacity>
            </View>

            {activeTab === 'scan' ? (
                <View className="flex-1 items-center justify-center p-8">
                    <View className="w-full aspect-square border-2 border-gray-100 rounded-3xl items-center justify-center bg-gray-50 mb-12 relative overflow-hidden">
                        {/* Placeholder for Camera View */}
                        <View className="absolute inset-0 border-[60px] border-white/80 z-10" />
                        <View className="w-64 h-64 border-2 border-primary border-dashed rounded-2xl items-center justify-center">
                            <Ionicons name="qr-code-outline" size={80} color="#D1D5DB" />
                        </View>
                        <View className="absolute bottom-10 z-20">
                            <Text className="text-gray-400 text-center font-bold">Align QR Code to scan</Text>
                        </View>
                    </View>

                    <TouchableOpacity className="flex-row items-center gap-2 mb-8">
                        <Ionicons name="image-outline" size={24} color="#0056D2" />
                        <Text className="text-primary font-bold">Upload from Gallery</Text>
                    </TouchableOpacity>

                    <View className="bg-blue-50 p-4 rounded-xl w-full flex-row items-center">
                        <Ionicons name="flashlight" size={24} color="#0056D2" />
                        <Text className="text-primary font-medium ml-3">Turn on Flashlight</Text>
                    </View>
                </View>
            ) : (
                <View className="flex-1 items-center justify-center p-8 bg-gray-50">
                    <View className="bg-white p-8 rounded-3xl shadow-lg items-center w-full max-w-[320px]">
                        <Text className="text-slate font-bold text-xl mb-1">Abu Mafhal</Text>
                        <Text className="text-gray-500 text-sm mb-6">@abumafhal</Text>

                        {/* QR Code Placeholder */}
                        <View className="w-48 h-48 bg-gray-100 rounded-2xl items-center justify-center mb-6">
                            <Ionicons name="qr-code" size={140} color="#1F2937" />
                        </View>

                        <Text className="text-gray-400 text-xs text-center px-4 leading-5 mb-8">
                            Scan this code to pay or transfer money to this account instantly.
                        </Text>

                        <TouchableOpacity className="w-full bg-gray-100 h-12 rounded-xl flex-row items-center justify-center">
                            <Ionicons name="share-social-outline" size={20} color="#374151" />
                            <Text className="text-slate font-bold ml-2">Share My Code</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </View>
    );
}
