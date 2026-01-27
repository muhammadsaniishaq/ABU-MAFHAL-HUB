import React from 'react';
import { View, Text, Modal, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface TransactionDetail {
    label: string;
    value: string;
    isAmount?: boolean;
    isDiscount?: boolean;
    isTotal?: boolean;
}

interface TransactionConfirmationModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    details: TransactionDetail[];
    network?: string; // 'mtn', 'glo', etc.
}

const NETWORK_LOGOS: Record<string, any> = {
    mtn: require('../assets/images/mtn.png'),
    glo: require('../assets/images/glo.png'),
    airtel: require('../assets/images/airtel.png'),
    '9mobile': require('../assets/images/9mobile.png'),
};

export default function TransactionConfirmationModal({ 
    visible, 
    onClose, 
    onConfirm, 
    title = 'Confirm Transaction',
    details,
    network
}: TransactionConfirmationModalProps) {
    
    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View className="flex-1 justify-end bg-black/60">
                <View className="bg-white rounded-t-3xl p-6 min-h-[50%]">
                    
                    {/* Handle Bar */}
                    <View className="items-center mb-6">
                        <View className="w-16 h-1.5 bg-gray-200 rounded-full" />
                    </View>

                    {/* Header */}
                    <View className="flex-row items-center justify-between mb-6">
                        <View>
                            <Text className="text-2xl font-bold text-gray-800">{title}</Text>
                            <Text className="text-gray-500 text-sm">Review details before proceeding</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} className="bg-gray-100 p-2 rounded-full">
                            <Ionicons name="close" size={24} color="#374151" />
                        </TouchableOpacity>
                    </View>

                    {/* Network Logo & Summary */}
                    <View className="items-center mb-6">
                        <View className="w-20 h-20 rounded-2xl bg-gray-50 items-center justify-center shadow-sm border border-gray-100 mb-3 relative">
                            {network && NETWORK_LOGOS[network.toLowerCase()] ? (
                                <Image source={NETWORK_LOGOS[network.toLowerCase()]} className="w-12 h-12 rounded-full" resizeMode="contain" />
                            ) : (
                                <Ionicons name="wallet" size={32} color="#9CA3AF" />
                            )}
                            <View className="absolute -bottom-2 -right-2 bg-green-500 rounded-full p-1.5 border-2 border-white">
                                <Ionicons name="checkmark" size={12} color="white" />
                            </View>
                        </View>
                        <Text className="font-bold text-gray-800 text-lg capitalize">{network || 'Transaction'}</Text>
                    </View>

                    {/* Details List */}
                    <View className="bg-gray-50 rounded-2xl p-4 mb-8 border border-gray-100">
                        {details.map((item, index) => (
                            <View key={index} className={`flex-row justify-between items-center py-3 ${index !== details.length - 1 ? 'border-b border-gray-200' : ''}`}>
                                <Text className={`font-medium text-sm ${item.isTotal ? 'text-gray-800 font-bold' : 'text-gray-500'}`}>
                                    {item.label}
                                </Text>
                                
                                {item.isDiscount ? (
                                    <View className="bg-green-100 px-2 py-1 rounded-md">
                                        <Text className="text-green-700 font-bold text-sm">{item.value}</Text>
                                    </View>
                                ) : (
                                    <Text className={`font-bold text-right ${
                                        item.isTotal ? 'text-blue-600 text-xl' : 
                                        item.isAmount ? 'text-gray-800 text-base' : 'text-gray-800'
                                    } ${item.label.includes('Original') ? 'line-through text-gray-400' : ''}`}>
                                        {item.value}
                                    </Text>
                                )}
                            </View>
                        ))}
                    </View>

                    {/* Actions */}
                    <View className="mt-auto">
                         <TouchableOpacity
                            onPress={onConfirm}
                            activeOpacity={0.8}
                            className="mb-3"
                        >
                            <LinearGradient
                                colors={['#2563EB', '#1D4ED8']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                className="h-14 rounded-2xl items-center justify-center shadow-lg shadow-blue-200"
                            >
                                <Text className="text-white font-bold text-lg">Confirm & Pay</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={onClose}
                            className="h-14 rounded-2xl items-center justify-center border border-gray-200 bg-white"
                        >
                            <Text className="text-gray-600 font-bold text-lg">Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
