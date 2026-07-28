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
                    tension: 100,
                    useNativeDriver: true
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 180,
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
            <View className="flex-1 justify-center items-center px-4 bg-slate-900/40">
                <Animated.View 
                    style={{
                        opacity: opacityAnim,
                        transform: [{ scale: scaleAnim }]
                    }}
                    className="bg-white border border-slate-100 rounded-2xl p-3.5 w-full max-w-[280px] shadow-2xl overflow-hidden"
                >
                    {/* Header bar */}
                    <View className="flex-row items-center justify-between pb-2 border-b border-slate-100 mb-2">
                        <View className="flex-row items-center gap-1.5">
                            <View className="w-1.5 h-1.5 rounded-full bg-[#f5a623]" />
                            <Text className="text-[#0d1b3e] font-black text-[12.5px]">{title}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} className="w-5 h-5 bg-slate-100 rounded-full items-center justify-center">
                            <Ionicons name="close" size={12} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    {/* Network & Amount Super Mini Hero Card */}
                    <View className="bg-slate-50 border border-slate-100 p-2 rounded-xl items-center mb-2 flex-row justify-between px-3">
                        <View className="flex-row items-center gap-1.5">
                            <View className="w-6 h-6 rounded-full bg-white items-center justify-center border border-slate-200 shadow-xs">
                                {network && NETWORK_LOGOS[network.toLowerCase()] ? (
                                    <Image source={NETWORK_LOGOS[network.toLowerCase()]} className="w-3.5 h-3.5 rounded-full" resizeMode="contain" />
                                ) : (
                                    <Ionicons name="cellular" size={10} color="#0d1b3e" />
                                )}
                            </View>
                            <Text className="text-slate-500 text-[10px] font-bold uppercase">{network || 'Data'}</Text>
                        </View>
                        <View className="items-end">
                            <Text className="text-slate-400 text-[8px] font-bold uppercase tracking-wider">Total</Text>
                            <Text className="text-[#0d1b3e] font-black text-base">{totalItem?.value || '₦0.00'}</Text>
                        </View>
                    </View>

                    {/* Decorative Security Badge */}
                    <View className="flex-row items-center justify-center gap-1 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full mb-2 self-center">
                        <Ionicons name="shield-checkmark" size={10} color="#059669" />
                        <Text className="text-emerald-700 text-[8.5px] font-black uppercase tracking-wider">256-Bit Encrypted Checkout</Text>
                    </View>

                    {/* Compact Details List */}
                    <View className="bg-slate-50/80 rounded-lg p-2 border border-slate-100 mb-2.5">
                        {details.filter(d => !d.isTotal).map((item, index) => (
                            <View key={index} className={`flex-row justify-between items-center py-1 ${index !== details.length - 2 ? 'border-b border-slate-100' : ''}`}>
                                <Text className="text-slate-500 font-bold text-[9.5px]">
                                    {item.label}
                                </Text>
                                <Text className="text-[#0d1b3e] font-black text-[9.5px] text-right" numberOfLines={1}>
                                    {item.value}
                                </Text>
                            </View>
                        ))}
                    </View>

                    {/* Mini Action Buttons */}
                    <View className="gap-1">
                        <TouchableOpacity
                            onPress={onConfirm}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={['#0d1b3e', '#142258']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                className="h-8.5 rounded-lg items-center justify-center shadow-xs flex-row gap-1"
                            >
                                <Ionicons name="checkmark-circle" size={13} color="#f5a623" />
                                <Text className="text-white font-black text-[10.5px] uppercase tracking-wider">Confirm & Pay</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={onClose}
                            className="h-7.5 rounded-lg items-center justify-center border border-slate-200 bg-white"
                        >
                            <Text className="text-slate-500 font-bold text-[10px]">Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}



