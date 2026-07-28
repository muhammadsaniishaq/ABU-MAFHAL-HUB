import React, { useEffect, useRef } from 'react';
import { View, Text, Modal, TouchableOpacity, Image, Animated, Easing, Platform } from 'react-native';
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
    title = 'Confirm Data Order',
    details,
    network
}: TransactionConfirmationModalProps) {
    const scaleAnim = useRef(new Animated.Value(0.85)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    friction: 7,
                    tension: 90,
                    useNativeDriver: true
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 200,
                    easing: Easing.out(Easing.ease),
                    useNativeDriver: true
                })
            ]).start();
        } else {
            scaleAnim.setValue(0.85);
            opacityAnim.setValue(0);
        }
    }, [visible]);

    const totalItem = details.find(d => d.isTotal) || details.find(d => d.isAmount);
    
    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View className="flex-1 justify-center items-center px-4 bg-slate-900/45">
                <Animated.View 
                    style={{
                        opacity: opacityAnim,
                        transform: [{ scale: scaleAnim }]
                    }}
                    className="bg-white border border-slate-100 rounded-3xl p-4.5 w-full max-w-[340px] shadow-2xl overflow-hidden"
                >
                    {/* Header bar */}
                    <View className="flex-row items-center justify-between pb-3 border-b border-slate-100 mb-3">
                        <View className="flex-row items-center gap-2">
                            <View className="w-2 h-2 rounded-full bg-[#f5a623]" />
                            <Text className="text-[#0d1b3e] font-black text-sm tracking-tight">{title}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} className="w-7 h-7 bg-slate-100 rounded-full items-center justify-center">
                            <Ionicons name="close" size={14} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    {/* Network & Amount Mini Hero Card */}
                    <View className="bg-slate-50 border border-slate-100 p-3 rounded-2xl flex-row items-center justify-between mb-3 shadow-xs">
                        <View className="flex-row items-center gap-2.5">
                            <View style={{ width: 34, height: 34, borderRadius: 17 }} className="bg-white items-center justify-center border border-slate-200 shadow-xs overflow-hidden">
                                {network && NETWORK_LOGOS[network.toLowerCase()] ? (
                                    <Image 
                                        source={NETWORK_LOGOS[network.toLowerCase()]} 
                                        style={{ width: 22, height: 22, borderRadius: 11 }} 
                                        resizeMode="contain" 
                                    />
                                ) : (
                                    <Ionicons name="cellular" size={16} color="#0d1b3e" />
                                )}
                            </View>
                            <View>
                                <Text className="text-[#0d1b3e] font-extrabold text-[13px] capitalize">{network || 'Data Bundle'}</Text>
                                <Text className="text-slate-400 text-[9.5px] font-bold uppercase tracking-wider">Instant Topup</Text>
                            </View>
                        </View>
                        
                        <View className="items-end">
                            <Text className="text-slate-400 text-[9px] font-bold uppercase tracking-wider">Total Amount</Text>
                            <Text className="text-[#0d1b3e] font-black text-lg mt-0.5">{totalItem?.value || '₦0.00'}</Text>
                        </View>
                    </View>

                    {/* Decorative Security Badge */}
                    <View className="flex-row items-center justify-center gap-1.5 bg-emerald-50 border border-emerald-100/80 px-2.5 py-1 rounded-full mb-3 self-center">
                        <Ionicons name="shield-checkmark" size={11} color="#059669" />
                        <Text className="text-emerald-700 text-[9.5px] font-black uppercase tracking-wider">256-Bit Encrypted Checkout</Text>
                    </View>

                    {/* Compact Details List */}
                    <View className="bg-slate-50/70 rounded-xl p-3 border border-slate-100 mb-3.5">
                        {details.filter(d => !d.isTotal).map((item, index) => (
                            <View key={index} className={`flex-row justify-between items-center py-1.5 ${index !== details.length - 2 ? 'border-b border-slate-100' : ''}`}>
                                <Text className="text-slate-500 font-bold text-[11px]">
                                    {item.label}
                                </Text>
                                <Text className="text-[#0d1b3e] font-black text-[11px] text-right" numberOfLines={1}>
                                    {item.value}
                                </Text>
                            </View>
                        ))}
                    </View>

                    {/* Action Buttons */}
                    <View className="gap-1.5">
                        <TouchableOpacity
                            onPress={onConfirm}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={['#0d1b3e', '#142258']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                className="h-11 rounded-xl items-center justify-center shadow-xs flex-row gap-1.5"
                            >
                                <Ionicons name="checkmark-circle" size={16} color="#f5a623" />
                                <Text className="text-white font-black text-[12px] uppercase tracking-wider">Confirm & Pay Now</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={onClose}
                            className="h-9 rounded-xl items-center justify-center border border-slate-200 bg-white"
                        >
                            <Text className="text-slate-500 font-bold text-[11px]">Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}




