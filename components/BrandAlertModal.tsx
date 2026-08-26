import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    Animated,
    Easing,
    StyleSheet,
    Platform,
    TouchableWithoutFeedback
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

export interface BrandAlertState {
    visible: boolean;
    title: string;
    message: string;
    type?: AlertType;
    buttonText?: string;
    onConfirm?: () => void;
    showCancel?: boolean;
    cancelText?: string;
    onCancel?: () => void;
}

interface BrandAlertModalProps {
    visible: boolean;
    title: string;
    message: string;
    type?: AlertType;
    buttonText?: string;
    onClose: () => void;
    showCancel?: boolean;
    cancelText?: string;
    onCancel?: () => void;
}

const TYPE_CONFIG = {
    success: {
        icon: 'checkmark-circle' as const,
        iconColor: '#10B981',
        bgColor: '#ECFDF5',
        borderColor: '#A7F3D0',
        badgeText: 'SUCCESS',
        badgeBg: '#D1FAE5',
        badgeColor: '#065F46',
    },
    error: {
        icon: 'alert-circle' as const,
        iconColor: '#EF4444',
        bgColor: '#FEF2F2',
        borderColor: '#FECACA',
        badgeText: 'NOTICE',
        badgeBg: '#FEE2E2',
        badgeColor: '#991B1B',
    },
    warning: {
        icon: 'warning' as const,
        iconColor: '#F59E0B',
        bgColor: '#FFFBEB',
        borderColor: '#FDE68A',
        badgeText: 'ATTENTION',
        badgeBg: '#FEF3C7',
        badgeColor: '#92400E',
    },
    info: {
        icon: 'information-circle' as const,
        iconColor: '#D4AF37',
        bgColor: '#FEF9E7',
        borderColor: '#FDE047',
        badgeText: 'INFO',
        badgeBg: '#FEF9E7',
        badgeColor: '#B45309',
    },
};

export default function BrandAlertModal({
    visible,
    title,
    message,
    type = 'info',
    buttonText = 'OK',
    onClose,
    showCancel = false,
    cancelText = 'Cancel',
    onCancel
}: BrandAlertModalProps) {
    const scaleAnim = useRef(new Animated.Value(0.88)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    const config = TYPE_CONFIG[type] || TYPE_CONFIG.info;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    friction: 7,
                    tension: 90,
                    useNativeDriver: Platform.OS !== 'web',
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 180,
                    easing: Easing.out(Easing.ease),
                    useNativeDriver: Platform.OS !== 'web',
                }),
            ]).start();
        } else {
            scaleAnim.setValue(0.88);
            opacityAnim.setValue(0);
        }
    }, [visible]);

    if (!visible) return null;

    return (
        <Modal
            transparent
            visible={visible}
            animationType="none"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.backdrop}>
                    <TouchableWithoutFeedback>
                        <Animated.View
                            style={[
                                styles.card,
                                {
                                    opacity: opacityAnim,
                                    transform: [{ scale: scaleAnim }],
                                },
                            ]}
                        >
                            {/* Gold Brand Trim Top Bar */}
                            <LinearGradient
                                colors={['#D4AF37', '#B48811', '#D4AF37']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.goldTopBar}
                            />

                            <View style={styles.bodyContent}>
                                {/* Icon Header */}
                                <View style={[styles.iconCircle, { backgroundColor: config.bgColor, borderColor: config.borderColor }]}>
                                    <Ionicons name={config.icon} size={32} color={config.iconColor} />
                                </View>

                                {/* Badge */}
                                <View style={[styles.badge, { backgroundColor: config.badgeBg }]}>
                                    <Text style={[styles.badgeText, { color: config.badgeColor }]}>
                                        {config.badgeText}
                                    </Text>
                                </View>

                                {/* Title */}
                                <Text style={styles.titleText}>{title}</Text>

                                {/* Message */}
                                <Text style={styles.messageText}>{message}</Text>

                                {/* Action Buttons */}
                                <View style={styles.buttonRow}>
                                    {showCancel && (
                                        <TouchableOpacity
                                            style={styles.cancelButton}
                                            onPress={onCancel || onClose}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={styles.cancelButtonText}>{cancelText}</Text>
                                        </TouchableOpacity>
                                    )}

                                    <TouchableOpacity
                                        style={[styles.primaryButton, !showCancel && { width: '100%' }]}
                                        onPress={onClose}
                                        activeOpacity={0.85}
                                    >
                                        <LinearGradient
                                            colors={['#0B192C', '#06101E']}
                                            style={styles.primaryButtonGradient}
                                        >
                                            <Text style={styles.primaryButtonText}>{buttonText}</Text>
                                            <Ionicons name="arrow-forward" size={14} color="#D4AF37" style={{ marginLeft: 6 }} />
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </Animated.View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(6, 16, 30, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    card: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: 'rgba(212, 175, 55, 0.4)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 12,
    },
    goldTopBar: {
        height: 4,
        width: '100%',
    },
    bodyContent: {
        paddingTop: 20,
        paddingBottom: 18,
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    iconCircle: {
        width: 58,
        height: 58,
        borderRadius: 29,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        marginBottom: 10,
    },
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 12,
        marginBottom: 8,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.8,
    },
    titleText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0B192C',
        textAlign: 'center',
        marginBottom: 6,
        letterSpacing: 0.2,
    },
    messageText: {
        fontSize: 12.5,
        color: '#475569',
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 18,
        paddingHorizontal: 4,
    },
    buttonRow: {
        flexDirection: 'row',
        width: '100%',
        gap: 10,
    },
    cancelButton: {
        flex: 1,
        height: 42,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    cancelButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748B',
    },
    primaryButton: {
        flex: 1,
        height: 42,
        borderRadius: 10,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#D4AF37',
    },
    primaryButtonGradient: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    primaryButtonText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#D4AF37',
        letterSpacing: 0.3,
    },
});
