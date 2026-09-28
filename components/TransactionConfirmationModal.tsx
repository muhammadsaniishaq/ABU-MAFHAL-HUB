import React, { useEffect, useRef, useState } from 'react';
import { 
    View, 
    Text, 
    Modal, 
    TouchableOpacity, 
    Image, 
    Animated, 
    Easing, 
    Platform, 
    StyleSheet, 
    ScrollView 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

export interface TransactionDetail {
    label: string;
    value: string;
    isAmount?: boolean;
    isDiscount?: boolean;
    isTotal?: boolean;
}

export interface TransactionConfirmationModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    details: TransactionDetail[];
    network?: string; // 'mtn', 'glo', 'airtel', '9mobile', 'vitel', etc.
}

const NETWORK_LOGOS: Record<string, any> = {
    mtn: require('../assets/images/mtn.png'),
    glo: require('../assets/images/glo.png'),
    airtel: require('../assets/images/airtel.png'),
    '9mobile': require('../assets/images/9mobile.png'),
    vitel: require('../assets/images/vitel.png'),
};

const NETWORK_THEMES: Record<string, { bg: string; text: string; border: string; accent: string; badgeBg: string }> = {
    mtn: { 
        bg: '#fffbeb', 
        text: '#92400e', 
        border: '#fde68a', 
        accent: '#eab308', 
        badgeBg: '#fef3c7' 
    },
    glo: { 
        bg: '#f0fdf4', 
        text: '#166534', 
        border: '#bbf7d0', 
        accent: '#16a34a', 
        badgeBg: '#dcfce7' 
    },
    airtel: { 
        bg: '#fef2f2', 
        text: '#991b1b', 
        border: '#fecaca', 
        accent: '#ef4444', 
        badgeBg: '#fee2e2' 
    },
    '9mobile': { 
        bg: '#ecfdf5', 
        text: '#065f46', 
        border: '#a7f3d0', 
        accent: '#059669', 
        badgeBg: '#d1fae5' 
    },
    vitel: { 
        bg: '#eef2ff', 
        text: '#3730a3', 
        border: '#c7d2fe', 
        accent: '#6366f1', 
        badgeBg: '#e0e7ff' 
    },
};

export default function TransactionConfirmationModal({ 
    visible, 
    onClose, 
    onConfirm, 
    title = 'Confirm Transaction Details',
    details,
    network
}: TransactionConfirmationModalProps) {
    const scaleAnim = useRef(new Animated.Value(0.88)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (visible) {
            setCopied(false);
            if (Platform.OS !== 'web') {
                try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                } catch {}
            }
            Animated.parallel([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    friction: 7.5,
                    tension: 95,
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
            scaleAnim.setValue(0.88);
            opacityAnim.setValue(0);
        }
    }, [visible]);

    const totalItem = details.find(d => d.isTotal) || details.find(d => d.isAmount);
    const netKey = (network || '').toLowerCase().trim();
    const netTheme = NETWORK_THEMES[netKey] || { 
        bg: '#f8fafc', 
        text: '#0d1b3e', 
        border: '#e2e8f0', 
        accent: '#0d1b3e', 
        badgeBg: '#f1f5f9' 
    };

    const handleCopyDetails = async () => {
        try {
            if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            const summary = details.map(d => `${d.label}: ${d.value}`).join('\n');
            await Clipboard.setStringAsync(summary);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (e) {}
    };

    const isWeb = Platform.OS === 'web';

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={s.modalOverlay}>
                <Animated.View 
                    style={[
                        s.modalCard,
                        isWeb && s.webModalCard,
                        {
                            opacity: opacityAnim,
                            transform: [{ scale: scaleAnim }]
                        }
                    ]}
                >
                    {/* Header Bar */}
                    <View style={s.headerBar}>
                        <View style={s.headerLeft}>
                            <View style={s.indicatorDot} />
                            <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
                        </View>
                        <TouchableOpacity 
                            onPress={onClose} 
                            style={s.closeButton}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Ionicons name="close" size={16} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    {/* Network & Amount Hero Card */}
                    <View style={[s.heroCard, { backgroundColor: netTheme.bg, borderColor: netTheme.border }]}>
                        <View style={s.heroLeft}>
                            <View style={s.networkLogoWrap}>
                                {network && NETWORK_LOGOS[netKey] ? (
                                    <Image 
                                        source={NETWORK_LOGOS[netKey]} 
                                        style={s.networkLogo} 
                                        resizeMode="contain" 
                                    />
                                ) : (
                                    <Ionicons name="flash" size={18} color="#0d1b3e" />
                                )}
                            </View>
                            <View>
                                <Text style={[s.heroNetworkName, { color: netTheme.text }]}>
                                    {network ? network.toUpperCase() : 'AIRTIME TOP-UP'}
                                </Text>
                                <View style={s.deliveryBadge}>
                                    <View style={s.greenStatusDot} />
                                    <Text style={s.deliveryBadgeText}>Instant Delivery</Text>
                                </View>
                            </View>
                        </View>
                        
                        <View style={s.heroRight}>
                            <Text style={s.totalLabel}>TOTAL AMOUNT</Text>
                            <Text style={s.totalValue}>{totalItem?.value || '₦0.00'}</Text>
                        </View>
                    </View>

                    {/* Security & Action Badges */}
                    <View style={s.badgesRow}>
                        <View style={s.securityBadge}>
                            <Ionicons name="shield-checkmark" size={11} color="#059669" />
                            <Text style={s.securityBadgeText}>256-Bit Encrypted</Text>
                        </View>
                        <TouchableOpacity 
                            onPress={handleCopyDetails}
                            style={[s.copyBadge, copied && s.copyBadgeActive]}
                            activeOpacity={0.7}
                        >
                            <Ionicons 
                                name={copied ? "checkmark-circle" : "copy-outline"} 
                                size={11} 
                                color={copied ? "#16a34a" : "#475569"} 
                            />
                            <Text style={[s.copyBadgeText, copied && s.copyBadgeTextActive]}>
                                {copied ? 'Copied Details' : 'Copy Summary'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Transaction Breakdown Table */}
                    <View style={s.detailsTableContainer}>
                        {details.filter(d => !d.isTotal).map((item, index, filteredArr) => {
                            const isLast = index === filteredArr.length - 1;
                            return (
                                <View 
                                    key={index} 
                                    style={[
                                        s.detailRow,
                                        !isLast && s.detailRowBorder
                                    ]}
                                >
                                    <Text style={s.detailLabel}>{item.label}</Text>
                                    
                                    {item.isDiscount ? (
                                        <View style={s.discountBadge}>
                                            <Ionicons name="sparkles" size={10} color="#16a34a" style={{ marginRight: 3 }} />
                                            <Text style={s.discountValue}>{item.value}</Text>
                                        </View>
                                    ) : (
                                        <Text 
                                            style={[
                                                s.detailValue,
                                                item.isAmount && s.detailValueAmount
                                            ]} 
                                            numberOfLines={1}
                                        >
                                            {item.value}
                                        </Text>
                                    )}
                                </View>
                            );
                        })}
                    </View>

                    {/* Action Buttons */}
                    <View style={s.actionButtonsContainer}>
                        <TouchableOpacity
                            onPress={() => {
                                if (Platform.OS !== 'web') {
                                    try {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                    } catch {}
                                }
                                onConfirm();
                            }}
                            activeOpacity={0.82}
                            style={s.confirmButtonWrapper}
                        >
                            <LinearGradient
                                colors={['#0d1b3e', '#142258', '#1a2b56']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={s.confirmButtonGradient}
                            >
                                <Ionicons name="checkmark-circle" size={18} color="#f5a623" style={{ marginRight: 6 }} />
                                <Text style={s.confirmButtonText}>Confirm & Pay Now</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={onClose}
                            style={s.cancelButton}
                            activeOpacity={0.7}
                        >
                            <Text style={s.cancelButtonText}>Cancel & Modify</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

const s = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(6, 13, 33, 0.72)',
        paddingHorizontal: 16,
    },
    modalCard: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 24,
        padding: 18,
        width: '100%',
        maxWidth: 350,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.18,
        shadowRadius: 20,
        elevation: 10,
    },
    webModalCard: {
        maxWidth: 380,
    },
    headerBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        marginBottom: 12,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        paddingRight: 8,
    },
    indicatorDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#f5a623',
        marginRight: 8,
    },
    headerTitle: {
        color: '#0d1b3e',
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: -0.2,
    },
    closeButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroCard: {
        borderWidth: 1,
        borderRadius: 16,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    heroLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    networkLogoWrap: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    networkLogo: {
        width: 26,
        height: 26,
        borderRadius: 13,
    },
    heroNetworkName: {
        fontSize: 13.5,
        fontWeight: '900',
        letterSpacing: 0.3,
    },
    deliveryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    greenStatusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#10b981',
        marginRight: 4,
    },
    deliveryBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    heroRight: {
        alignItems: 'flex-end',
    },
    totalLabel: {
        fontSize: 9,
        fontWeight: '800',
        color: '#64748b',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    totalValue: {
        fontSize: 18,
        fontWeight: '900',
        color: '#0d1b3e',
        marginTop: 1,
        letterSpacing: -0.3,
    },
    badgesRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 12,
    },
    securityBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ecfdf5',
        borderWidth: 1,
        borderColor: '#d1fae5',
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 20,
        gap: 4,
    },
    securityBadgeText: {
        color: '#047857',
        fontSize: 9.5,
        fontWeight: '800',
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },
    copyBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 20,
        gap: 4,
    },
    copyBadgeActive: {
        backgroundColor: '#f0fdf4',
        borderColor: '#bbf7d0',
    },
    copyBadgeText: {
        color: '#475569',
        fontSize: 9.5,
        fontWeight: '800',
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },
    copyBadgeTextActive: {
        color: '#15803d',
    },
    detailsTableContainer: {
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 14,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 9,
    },
    detailRowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: '#edf2f7',
    },
    detailLabel: {
        color: '#64748b',
        fontSize: 11.5,
        fontWeight: '600',
    },
    detailValue: {
        color: '#0d1b3e',
        fontSize: 12,
        fontWeight: '800',
        textAlign: 'right',
        flexShrink: 1,
        marginLeft: 8,
    },
    detailValueAmount: {
        color: '#0d1b3e',
        fontWeight: '900',
    },
    discountBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#dcfce7',
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
    },
    discountValue: {
        color: '#15803d',
        fontSize: 11.5,
        fontWeight: '800',
    },
    actionButtonsContainer: {
        gap: 8,
    },
    confirmButtonWrapper: {
        borderRadius: 14,
        overflow: 'hidden',
        shadowColor: '#0d1b3e',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 3,
    },
    confirmButtonGradient: {
        height: 46,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmButtonText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    cancelButton: {
        height: 38,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
    },
    cancelButtonText: {
        color: '#64748b',
        fontSize: 11.5,
        fontWeight: '700',
    },
});
