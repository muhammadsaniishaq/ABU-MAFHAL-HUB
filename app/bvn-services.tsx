import { View, Text, TouchableOpacity, ScrollView, TextInput, Modal } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';

export default function BVNServicesScreen() {
    const [bvn, setBvn] = useState('');
    const [view, setView] = useState<'menu' | 'validate' | 'modify' | 'slip'>('menu');
    const [showSlip, setShowSlip] = useState(false);

    const renderSlip = () => (
        <Modal visible={showSlip} animationType="slide" transparent={true}>
            <View className="flex-1 bg-black/80 justify-center p-6">
                <View className="bg-white rounded-3xl p-8 items-center border-4 border-primary/20">
                    <Text className="text-primary font-bold text-xl mb-6">BVN VERIFICATION SLIP</Text>

                    <View className="w-full bg-gray-50 p-4 rounded-xl mb-6 border border-gray-100">
                        <View className="flex-row justify-between mb-4">
                            <View>
                                <Text className="text-gray-400 text-[10px] uppercase font-bold">Full Name</Text>
                                <Text className="text-slate font-bold">ABU MAFHAL HUB</Text>
                            </View>
                            <View className="items-end">
                                <Text className="text-gray-400 text-[10px] uppercase font-bold">BVN Number</Text>
                                <Text className="text-slate font-bold">222******89</Text>
                            </View>
                        </View>
                        <View className="flex-row justify-between">
                            <View>
                                <Text className="text-gray-400 text-[10px] uppercase font-bold">Date of Birth</Text>
                                <Text className="text-slate font-bold">12-JAN-1995</Text>
                            </View>
                            <View className="items-end">
                                <Text className="text-gray-400 text-[10px] uppercase font-bold">Phone</Text>
                                <Text className="text-slate font-bold">0803****000</Text>
                            </View>
                        </View>
                    </View>

                    <View className="w-32 h-32 bg-gray-100 rounded-xl items-center justify-center mb-6">
                        <Ionicons name="qr-code" size={100} color="#1F2937" />
                    </View>

                    <TouchableOpacity
                        className="w-full bg-primary h-14 rounded-xl items-center justify-center flex-row"
                        onPress={() => setShowSlip(false)}
                    >
                        <Ionicons name="download-outline" size={20} color="white" className="mr-2" />
                        <Text className="text-white font-bold ml-2">Download Slip</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        className="mt-4 p-2"
                        onPress={() => setShowSlip(false)}
                    >
                        <Text className="text-gray-400 font-bold">Close</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );

    return (
        <View className="flex-1 bg-gray-50">
            <Stack.Screen options={{ title: 'BVN Services', headerTintColor: '#0056D2' }} />
            <StatusBar style="dark" />
            {renderSlip()}

            <ScrollView className="p-6">
                {view === 'menu' && (
                    <View>
                        <View className="bg-blue-600 p-6 rounded-2xl mb-8">
                            <Text className="text-white text-xl font-bold mb-2">BVN Advanced Hub</Text>
                            <Text className="text-blue-100 text-sm">Validate, modify or print your BVN documents instantly.</Text>
                        </View>

                        <TouchableOpacity
                            onPress={() => setView('validate')}
                            className="bg-white p-5 rounded-2xl mb-4 flex-row items-center shadow-sm border border-gray-100"
                        >
                            <View className="w-12 h-12 rounded-full bg-blue-50 items-center justify-center mr-4">
                                <Ionicons name="checkmark-shield" size={24} color="#0056D2" />
                            </View>
                            <View className="flex-1">
                                <Text className="font-bold text-slate text-base">Validate BVN</Text>
                                <Text className="text-gray-500 text-xs">Verify if a BVN is valid and active.</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setShowSlip(true)}
                            className="bg-white p-5 rounded-2xl mb-4 flex-row items-center shadow-sm border border-gray-100"
                        >
                            <View className="w-12 h-12 rounded-full bg-green-50 items-center justify-center mr-4">
                                <Ionicons name="print" size={24} color="#107C10" />
                            </View>
                            <View className="flex-1">
                                <Text className="font-bold text-slate text-base">Print BVN Slip</Text>
                                <Text className="text-gray-500 text-xs">Generate and download your BVN slip.</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setView('modify')}
                            className="bg-white p-5 rounded-2xl mb-4 flex-row items-center shadow-sm border border-gray-100"
                        >
                            <View className="w-12 h-12 rounded-full bg-orange-50 items-center justify-center mr-4">
                                <Ionicons name="create" size={24} color="#F37021" />
                            </View>
                            <View className="flex-1">
                                <Text className="font-bold text-slate text-base">Modification Request</Text>
                                <Text className="text-gray-500 text-xs">Correction of Name, DOB or Phone.</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
                        </TouchableOpacity>
                    </View>
                )}

                {view === 'validate' && (
                    <View>
                        <TouchableOpacity onPress={() => setView('menu')} className="flex-row items-center mb-6">
                            <Ionicons name="arrow-back" size={20} color="#0056D2" />
                            <Text className="text-primary font-bold ml-2">Back to Menu</Text>
                        </TouchableOpacity>
                        <Text className="text-slate font-bold text-lg mb-4">Validate BVN</Text>
                        <TextInput
                            placeholder="Enter 11-digit BVN"
                            className="bg-white h-14 rounded-xl px-4 border border-gray-200 mb-6"
                            keyboardType="number-pad"
                            maxLength={11}
                            value={bvn}
                            onChangeText={setBvn}
                        />
                        <TouchableOpacity className="bg-primary h-14 rounded-xl items-center justify-center">
                            <Text className="text-white font-bold">Proceed Validation</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {view === 'modify' && (
                    <View>
                        <TouchableOpacity onPress={() => setView('menu')} className="flex-row items-center mb-6">
                            <Ionicons name="arrow-back" size={20} color="#0056D2" />
                            <Text className="text-primary font-bold ml-2">Back to Menu</Text>
                        </TouchableOpacity>
                        <Text className="text-slate font-bold text-lg mb-4">Modification Request</Text>

                        <View className="bg-white p-6 rounded-2xl border border-gray-100 mb-6">
                            <Text className="text-gray-400 text-xs font-bold mb-4 uppercase">Select Modification Type</Text>
                            {['Name Change', 'Date of Birth', 'Phone Number'].map((type) => (
                                <TouchableOpacity key={type} className="flex-row items-center justify-between py-4 border-b border-gray-50">
                                    <Text className="text-slate font-medium">{type}</Text>
                                    <Ionicons name="ellipse-outline" size={20} color="#CBD5E1" />
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TextInput
                            placeholder="Enter New Details"
                            className="bg-white h-14 rounded-xl px-4 border border-gray-200 mb-6"
                        />

                        <TouchableOpacity className="bg-primary h-14 rounded-xl items-center justify-center">
                            <Text className="text-white font-bold">Submit Request</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}
