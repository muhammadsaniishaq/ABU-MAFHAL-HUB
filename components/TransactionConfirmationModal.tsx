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
    title = 'Confirm Data Purchase',
    details,
    network
}: TransactionConfirmationModalProps) {
    const totalItem = details.find(d => d.isTotal) || details.find(d => d.isAmount);
    
    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View className="flex-1 justify-center items-center px-4 bg-slate-900/40">
                <View className="bg-white border border-slate-100 rounded-2xl p-3.5 w-full max-w-[290px] shadow-xl overflow-hidden">
                    
                    {/* Header bar */}
                    <View className="flex-row items-center justify-between pb-2 border-b border-slate-100 mb-2.5">
                        <View className="flex-row items-center gap-1.5">
                            <View className="w-2 h-2 rounded-full bg-[#f5a623]" />
                            <Text className="text-[#0d1b3e] font-black text-[13px]">{title}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} className="w-6 h-6 bg-slate-100 rounded-full items-center justify-center">
                            <Ionicons name="close" size={14} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    {/* Network & Amount Mini Hero Card */}
                    <View className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl items-center mb-2.5">
                        <View className="w-8 h-8 rounded-full bg-white items-center justify-center border border-slate-200 mb-1 shadow-xs">
                            {network && NETWORK_LOGOS[network.toLowerCase()] ? (
                                <Image source={NETWORK_LOGOS[network.toLowerCase()]} className="w-5 h-5 rounded-full" resizeMode="contain" />
                            ) : (
                                <Ionicons name="cellular" size={14} color="#0d1b3e" />
                            )}
                        </View>
                        <Text className="text-slate-400 text-[9px] font-bold uppercase tracking-wider">Total Amount</Text>
                        <Text className="text-[#0d1b3e] font-black text-xl mt-0.5">{totalItem?.value || '₦0.00'}</Text>
                    </View>

                    {/* Compact Details List */}
                    <View className="bg-slate-50/80 rounded-lg p-2.5 border border-slate-100 mb-3">
                        {details.filter(d => !d.isTotal).map((item, index) => (
                            <View key={index} className={`flex-row justify-between items-center py-1 ${index !== details.length - 2 ? 'border-b border-slate-100' : ''}`}>
                                <Text className="text-slate-500 font-bold text-[10px]">
                                    {item.label}
                                </Text>
                                <Text className="text-[#0d1b3e] font-black text-[10px] text-right" numberOfLines={1}>
                                    {item.value}
                                </Text>
                            </View>
                        ))}
                    </View>

                    {/* Mini Action Buttons */}
                    <View className="gap-1.5">
                        <TouchableOpacity
                            onPress={onConfirm}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={['#0d1b3e', '#142258']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                className="h-9 rounded-lg items-center justify-center shadow-xs flex-row gap-1"
                            >
                                <Ionicons name="checkmark-circle" size={14} color="#f5a623" />
                                <Text className="text-white font-black text-[11px] uppercase tracking-wider">Confirm & Pay</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={onClose}
                            className="h-8 rounded-lg items-center justify-center border border-slate-200 bg-white"
                        >
                            <Text className="text-slate-500 font-bold text-[11px]">Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}


