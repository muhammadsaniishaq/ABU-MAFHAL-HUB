import { View, Text, TouchableOpacity, ScrollView, TextInput, Modal, Image, ActivityIndicator, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { api } from '../services/api';

export default function NINServicesScreen() {
    const [nin, setNin] = useState('');
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState<'menu' | 'validate' | 'modify' | 'slip'>('menu');
    const [showSlip, setShowSlip] = useState(false);

    const handleValidate = async () => {
        setLoading(true);
        try {
            const result = await api.identity.validateNIN(nin);
            if (result.isValid) {
                Alert.alert("Success", "NIN Verified Successfully!");
                // Here we would typically navigate to a details screen or show the data
            } else {
                Alert.alert("Verification Failed", result.message);
            }
        } catch (error) {
            Alert.alert("Error", "Service unreachable");
        } finally {
            setLoading(false);
        }
    };

    const renderSlip = () => (
        <Modal visible={showSlip} animationType="slide" transparent={true}>
            <View className="flex-1 bg-black/90 justify-center p-6">
                <View className="bg-white rounded-3xl p-6 items-center border-[8px] border-green-50 overflow-hidden relative">
                    {/* Watermark/Background decoration */}
                    <View className="absolute top-20 -left-10 w-60 h-60 bg-green-50 rounded-full opacity-50" />
                    <View className="absolute bottom-10 -right-10 w-40 h-40 bg-green-50 rounded-full opacity-50" />

                    <View className="flex-row items-center mb-8 w-full border-b border-gray-100 pb-4">
                        <Image source={require('../assets/images/logo-icon.png')} className="w-10 h-10 rounded-full bg-green-100 mr-3" />
                        <View>
                            <Text className="text-green-700 font-extrabold text-xs tracking-widest">FEDERAL REPUBLIC OF NIGERIA</Text>
                            <Text className="text-slate font-bold text-xs">NATIONAL IDENTITY MANAGEMENT SYSTEM</Text>
                        </View>
                    </View>

                    <View className="flex-row w-full mb-8">
                        <View className="w-28 h-28 bg-gray-200 rounded-xl mr-5 border-2 border-white shadow-sm" />
                        <View className="flex-1 justify-center gap-3">
                            <View>
                                <Text className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">Surname</Text>
                                <Text className="text-slate font-bold text-lg">ABU MAFHAL</Text>
                            </View>
                            <View>
                                <Text className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">Given Names</Text>
                                <Text className="text-slate font-bold text-lg">DEVELOPER</Text>
                            </View>
                        </View>
                    </View>

                    <View className="w-full bg-green-50 p-5 rounded-2xl mb-8 border border-green-100 items-center">
                        <Text className="text-green-800 text-center font-black text-3xl tracking-[6px]">5423 8810 223</Text>
                        <Text className="text-green-600 text-center text-[10px] font-bold mt-2 uppercase tracking-widest">National Identification Number</Text>
                    </View>

                    <TouchableOpacity
                        className="w-full bg-green-700 h-14 rounded-2xl items-center justify-center flex-row shadow-lg shadow-green-700/30"
                        onPress={() => setShowSlip(false)}
                    >
                        <Ionicons name="cloud-download" size={20} color="white" />
                        <Text className="text-white font-bold ml-2 text-lg">Save PDF Slip</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        className="mt-6 p-2"
                        onPress={() => setShowSlip(false)}
                    >
                        <Text className="text-gray-400 font-bold text-sm">Close Preview</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );

    return (
        <View className="flex-1 bg-gray-50">
            <Stack.Screen options={{ title: 'NIN Services', headerTintColor: '#0056D2' }} />
            <StatusBar style="dark" />
            {renderSlip()}

            <ScrollView className="p-6">
                {view === 'menu' && (
                    <View>
                        <View className="bg-green-700 p-8 rounded-3xl mb-8 shadow-lg shadow-green-700/20 relative overflow-hidden">
                            <View className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10" />
                            <Text className="text-white text-2xl font-bold mb-2">NIN Identity Hub</Text>
                            <Text className="text-green-100 text-sm leading-5">Official interface for National Identity Management Commission (NIMC) services.</Text>
                        </View>

                        <Text className="text-slate font-bold text-lg mb-4">Available Services</Text>
                        <View className="flex-row flex-wrap justify-between gap-y-4">
                            <TouchableOpacity
                                onPress={() => setView('validate')}
                                className="w-[48%] bg-white p-5 rounded-3xl border border-gray-100 shadow-sm items-center text-center"
                            >
                                <View className="w-14 h-14 rounded-full bg-green-50 items-center justify-center mb-4">
                                    <Ionicons name="scan" size={28} color="#15803D" />
                                </View>
                                <Text className="font-bold text-slate text-base mb-1">Validate</Text>
                                <Text className="text-gray-400 text-xs text-center">Check Status</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setShowSlip(true)}
                                className="w-[48%] bg-white p-5 rounded-3xl border border-gray-100 shadow-sm items-center text-center"
                            >
                                <View className="w-14 h-14 rounded-full bg-blue-50 items-center justify-center mb-4">
                                    <Ionicons name="print" size={28} color="#1D4ED8" />
                                </View>
                                <Text className="font-bold text-slate text-base mb-1">Print Slip</Text>
                                <Text className="text-gray-400 text-xs text-center">Digital ID</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setView('modify')}
                                className="w-full bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex-row items-center"
                            >
                                <View className="w-14 h-14 rounded-full bg-purple-50 items-center justify-center mr-4">
                                    <Ionicons name="create" size={28} color="#7E22CE" />
                                </View>
                                <View className="flex-1">
                                    <Text className="font-bold text-slate text-base mb-1">Modification</Text>
                                    <Text className="text-gray-400 text-xs">Correction of Name, DOB, etc.</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {view === 'validate' && (
                    <View>
                        <TouchableOpacity onPress={() => setView('menu')} className="flex-row items-center mb-6">
                            <Ionicons name="arrow-back" size={20} color="#15803D" />
                            <Text className="text-green-700 font-bold ml-2">Back to Menu</Text>
                        </TouchableOpacity>
                        <Text className="text-slate font-bold text-lg mb-4">Validate NIN</Text>
                        <TextInput
                            placeholder="Enter 11-digit NIN"
                            className="bg-white h-14 rounded-xl px-4 border border-gray-200 mb-6"
                            keyboardType="number-pad"
                            maxLength={11}
                            value={nin}
                            onChangeText={setNin}
                            editable={!loading}
                        />
                        <TouchableOpacity
                            className={`h-14 rounded-xl items-center justify-center ${nin.length === 11 && !loading ? 'bg-green-700' : 'bg-gray-300'}`}
                            disabled={nin.length !== 11 || loading}
                            onPress={handleValidate}
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text className="text-white font-bold">Check NIN Status</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {view === 'modify' && (
                    <View>
                        <TouchableOpacity onPress={() => setView('menu')} className="flex-row items-center mb-6">
                            <Ionicons name="arrow-back" size={20} color="#15803D" />
                            <Text className="text-green-700 font-bold ml-2">Back to Menu</Text>
                        </TouchableOpacity>
                        <Text className="text-slate font-bold text-lg mb-4">NIMC Modification</Text>

                        <View className="bg-white p-5 rounded-2xl border border-gray-100 mb-6">
                            <Text className="text-gray-400 text-[10px] font-bold mb-4 uppercase">Data to Correct</Text>
                            {['Name Corretion', 'Birth Date Update', 'Document Attachment'].map((type) => (
                                <TouchableOpacity key={type} className="flex-row items-center justify-between py-4 border-b border-gray-50">
                                    <View className="flex-row items-center">
                                        <Ionicons name="radio-button-off" size={18} color="#CBD5E1" className="mr-3" />
                                        <Text className="text-slate font-medium ml-2">{type}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity className="bg-green-700 h-14 rounded-xl items-center justify-center">
                            <Text className="text-white font-bold">Apply for Modification</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}
