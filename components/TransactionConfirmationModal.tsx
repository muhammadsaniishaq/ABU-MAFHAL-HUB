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
            <View className="flex-1 justify-center items-center px-4 bg-black/80">
                <View className="bg-[#060d21] border border-slate-800 rounded-3xl p-5 w-full max-w-[360px] shadow-2xl overflow-hidden">
                    
                    {/* Header bar */}
                    <View className="flex-row items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
                        <View className="flex-row items-center gap-2">
                            <View className="w-2 h-2 rounded-full bg-[#f5a623]" />
                            <Text className="text-white font-extrabold text-[15px]">{title}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} className="w-7 h-7 bg-slate-900 rounded-full items-center justify-center border border-slate-800">
                            <Ionicons name="close" size={16} color="#94a3b8" />
                        </TouchableOpacity>
                    </View>

                    {/* Network & Amount Hero Card */}
                    <View className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl items-center mb-3">
                        <View className="w-12 h-12 rounded-full bg-slate-800 items-center justify-center border border-slate-700 mb-2">
                            {network && NETWORK_LOGOS[network.toLowerCase()] ? (
                                <Image source={NETWORK_LOGOS[network.toLowerCase()]} className="w-8 h-8 rounded-full" resizeMode="contain" />
                            ) : (
                                <Ionicons name="cellular" size={20} color="#f5a623" />
                            )}
                        </View>
                        <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Total Payable Amount</Text>
                        <Text className="text-[#f5a623] font-black text-2xl mt-0.5">{totalItem?.value || '₦0.00'}</Text>
                    </View>

                    {/* Compact Details List */}
                    <View className="bg-slate-950/80 rounded-xl p-3 border border-slate-800/60 mb-4">
                        {details.filter(d => !d.isTotal).map((item, index) => (
                            <View key={index} className={`flex-row justify-between items-center py-1.5 ${index !== details.length - 2 ? 'border-b border-slate-900' : ''}`}>
                                <Text className="text-slate-400 font-bold text-[11px]">
                                    {item.label}
                                </Text>
                                <Text className="text-white font-bold text-[11px] text-right" numberOfLines={1}>
                                    {item.value}
                                </Text>
                            </View>
                        ))}
                    </View>

                    {/* Action Buttons */}
                    <View className="gap-2">
                        <TouchableOpacity
                            onPress={onConfirm}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={['#f5a623', '#d97706']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                className="h-11 rounded-xl items-center justify-center shadow-lg flex-row gap-1.5"
                            >
                                <Ionicons name="checkmark-circle" size={18} color="#060d21" />
                                <Text className="text-[#060d21] font-black text-[13px] uppercase tracking-wider">Confirm & Pay Now</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={onClose}
                            className="h-10 rounded-xl items-center justify-center border border-slate-800 bg-slate-900"
                        >
                            <Text className="text-slate-400 font-bold text-[12px]">Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

