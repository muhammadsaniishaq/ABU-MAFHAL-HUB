import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { supabase } from '../../../services/supabase';
import BrandAlertModal, { AlertType } from '../../../components/BrandAlertModal';

const SERVICES = [
    { id: 'nin', pricingId: 'nin_premium', title: 'Verify NIN', desc: 'Premium, Standard & Regular Slips', icon: 'finger-print-outline', route: '/nin-services/verify-nin' },
    { id: 'mod', pricingId: 'nin_mod_name', title: 'NIN Modification', desc: 'Change Name, Phone, or Address', icon: 'create-outline', route: '/nin-services/modification' },
    { id: 'bvn', pricingId: 'vnin_val', title: 'BVN Validation', desc: 'Verify & generate BVN cards', icon: 'card-outline', route: '/nin-services/validation' },
    { id: 'phone', pricingId: 'nin_phone', title: 'Verify by Phone', desc: 'Find NIN via linked phone', icon: 'call-outline', route: '/nin-services/verify-phone' },
    { id: 'demo', pricingId: 'nin_verify', title: 'Demographic Search', desc: 'Lookup NIN by Name & DOB', icon: 'people-outline', route: '/nin-services/demographic' },
    { id: 'val', pricingId: 'nin_val_norecord', title: 'NIN Validation', desc: 'Resolve no-record errors', icon: 'checkmark-circle-outline', route: '/nin-services/validation' },
    { id: 'ipe', pricingId: 'ipe_clearance', title: 'IPE Clearance', desc: 'Pre-employment verification', icon: 'briefcase-outline', route: '/nin-services/ipe-clearance' },
    { id: 'track', pricingId: 'pers_status', title: 'Personalization', desc: 'Check status & tracking ID', icon: 'shield-checkmark-outline', route: '/nin-services/tracking' },
    { id: 'delink', pricingId: 'nin_mod_phone', title: 'Delink Phone', desc: 'Remove phone from NIN record', icon: 'cut-outline', route: '/nin-services/delink' },
    { id: 'history', pricingId: 'history', title: 'NIN History', desc: 'View past logs & reprints', icon: 'time-outline', route: '/nin-services/history' },
];

export default function NINServicesScreen() {
    const insets = useSafeAreaInsets();
    const [serviceStatuses, setServiceStatuses] = useState<Record<string, { status: string; msg?: string }>>({});
    const [globalNINStatus, setGlobalNINStatus] = useState<'active' | 'maintenance' | 'hidden'>('active');
    const [globalNINMsg, setGlobalNINMsg] = useState('NIMC portal infrastructure is currently undergoing scheduled optimization. Services will resume shortly.');

    const [alertConfig, setAlertConfig] = useState<{
        visible: boolean;
        title: string;
        message: string;
        type: AlertType;
    }>({
        visible: false,
        title: '',
        message: '',
        type: 'info',
    });

    const fetchServiceVisibilityAndMaintenance = async () => {
        try {
            // 1. Global Settings
            const { data: globalSettings } = await supabase
                .from('app_settings')
                .select('key, value')
                .in('key', ['nin_global_status', 'nin_global_maintenance_msg']);

            if (globalSettings) {
                const gStatus = globalSettings.find(s => s.key === 'nin_global_status');
                if (gStatus?.value) setGlobalNINStatus(gStatus.value as any);
                const gMsg = globalSettings.find(s => s.key === 'nin_global_maintenance_msg');
                if (gMsg?.value) setGlobalNINMsg(gMsg.value);
            }

            // 2. Individual Service Statuses
            const { data: pricingRows } = await supabase
                .from('service_pricing')
                .select('id, status, maintenance_msg')
                .eq('service_category', 'nin');

            if (pricingRows && pricingRows.length > 0) {
                const map: Record<string, { status: string; msg?: string }> = {};
                pricingRows.forEach(row => {
                    map[row.id] = {
                        status: row.status || 'active',
                        msg: row.maintenance_msg || undefined,
                    };
                });
                setServiceStatuses(map);
            }
        } catch (e) {
            console.warn('Failed to load NIN service statuses', e);
        }
    };

    useEffect(() => {
        fetchServiceVisibilityAndMaintenance();
    }, []);

    const handleServicePress = (service: typeof SERVICES[0]) => {
        if (globalNINStatus === 'maintenance') {
            setAlertConfig({
                visible: true,
                title: 'Gateway Maintenance',
                message: globalNINMsg,
                type: 'warning',
            });
            return;
        }

        const currentStatusObj = serviceStatuses[service.pricingId];
        if (currentStatusObj && currentStatusObj.status === 'maintenance') {
            setAlertConfig({
                visible: true,
                title: `${service.title} - Maintenance`,
                message: currentStatusObj.msg || `${service.title} is currently paused for routine server maintenance. Please check back shortly.`,
                type: 'warning',
            });
            return;
        }

        router.push(service.route as any);
    };

    // Filter out services hidden by Admin
    const visibleServices = SERVICES.filter(service => {
        const itemStatus = serviceStatuses[service.pricingId]?.status;
        return itemStatus !== 'hidden';
    });

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />
            
            <LinearGradient 
                colors={['#0B192C', '#06101E']} 
                style={[styles.headerGradient, { paddingTop: Math.max(insets.top, 20) + 6, paddingBottom: 22 }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
                        <Ionicons name="chevron-back" size={18} color="#ffffff" />
                    </TouchableOpacity>
                    <View style={styles.secureBadge}>
                        <View style={[styles.secureDot, globalNINStatus === 'maintenance' && { backgroundColor: '#F59E0B' }]} />
                        <Text style={styles.secureText}>
                            {globalNINStatus === 'maintenance' ? 'GATEWAY UNDER MAINTENANCE' : 'NIMC VERIFIED'}
                        </Text>
                    </View>
                </View>

                <View style={styles.titleRow}>
                    <Ionicons name="shield-checkmark" size={20} color="#D4AF37" />
                    <Text style={styles.titleText}>NIN Services</Text>
                </View>
                <Text style={styles.subtitleText}>National Identity Management Gateway</Text>
            </LinearGradient>

            <ScrollView style={styles.content} contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 24) + 60 }]} showsVerticalScrollIndicator={false}>
                {/* Global Maintenance Banner */}
                {globalNINStatus === 'maintenance' && (
                    <View style={styles.globalMaintBanner}>
                        <Ionicons name="construct-outline" size={18} color="#B45309" />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.globalMaintTitle}>Routine Gateway Maintenance</Text>
                            <Text style={styles.globalMaintDesc}>{globalNINMsg}</Text>
                        </View>
                    </View>
                )}

                <View style={styles.grid}>
                    {visibleServices.map((service) => {
                        const isMaint = serviceStatuses[service.pricingId]?.status === 'maintenance';
                        return (
                            <TouchableOpacity 
                                key={service.id}
                                onPress={() => handleServicePress(service)}
                                style={[styles.menuItem, isMaint && styles.menuItemMaint]}
                                activeOpacity={0.8}
                            >
                                <View style={styles.menuHeader}>
                                    <View style={[styles.iconBox, isMaint && { backgroundColor: '#FEF3C7' }]}>
                                        <Ionicons name={service.icon as any} size={18} color={isMaint ? '#B45309' : '#D4AF37'} />
                                    </View>
                                    {isMaint ? (
                                        <View style={styles.maintPill}>
                                            <Text style={styles.maintPillText}>MAINTENANCE</Text>
                                        </View>
                                    ) : (
                                        <Ionicons name="chevron-forward" size={14} color="#94a3b8" />
                                    )}
                                </View>
                                <Text style={styles.menuTitle} numberOfLines={1}>{service.title}</Text>
                                <Text style={styles.menuDesc} numberOfLines={1}>{service.desc}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Support Banner */}
                <View style={styles.supportBanner}>
                    <View style={styles.supportLeft}>
                        <Text style={styles.supportTitle}>Need Help with NIN?</Text>
                        <Text style={styles.supportDesc}>Contact support for validation or modification help</Text>
                    </View>
                    <TouchableOpacity 
                        style={styles.supportButton} 
                        activeOpacity={0.8}
                        onPress={() => router.push('/(app)/support')}
                    >
                        <Ionicons name="chatbubbles-outline" size={16} color="#0B192C" />
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <BrandAlertModal
                visible={alertConfig.visible}
                title={alertConfig.title}
                message={alertConfig.message}
                type={alertConfig.type}
                onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    headerGradient: {
        paddingHorizontal: 16,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    backButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    secureBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    secureDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#10B981',
        marginRight: 5,
    },
    secureText: {
        color: '#ffffff',
        fontSize: 9.5,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 1,
    },
    titleText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '900',
    },
    subtitleText: {
        color: '#94a3b8',
        fontSize: 11,
        marginBottom: 6,
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        padding: 14,
    },
    globalMaintBanner: {
        flexDirection: 'row',
        gap: 8,
        backgroundColor: '#FFFBEB',
        borderRadius: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: '#FDE68A',
        marginBottom: 12,
    },
    globalMaintTitle: {
        fontSize: 11.5,
        fontWeight: '900',
        color: '#B45309',
    },
    globalMaintDesc: {
        fontSize: 10,
        color: '#92400E',
        marginTop: 1,
        lineHeight: 13,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    menuItem: {
        width: '48.3%',
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    menuItemMaint: {
        borderColor: '#FDE68A',
        backgroundColor: '#FFFDF5',
    },
    menuHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    iconBox: {
        width: 34,
        height: 34,
        borderRadius: 8,
        backgroundColor: '#0B192C',
        alignItems: 'center',
        justifyContent: 'center',
    },
    maintPill: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 4,
    },
    maintPillText: {
        fontSize: 7,
        fontWeight: '900',
        color: '#B45309',
    },
    menuTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#0B192C',
        marginBottom: 2,
    },
    menuDesc: {
        fontSize: 9.5,
        color: '#64748B',
        lineHeight: 13,
    },
    supportBanner: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#0B192C',
        borderRadius: 12,
        padding: 14,
        marginTop: 16,
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.2)',
    },
    supportLeft: {
        flex: 1,
    },
    supportTitle: {
        color: '#ffffff',
        fontSize: 12.5,
        fontWeight: '800',
    },
    supportDesc: {
        color: '#94a3b8',
        fontSize: 10,
        marginTop: 1,
    },
    supportButton: {
        width: 34,
        height: 34,
        borderRadius: 8,
        backgroundColor: '#D4AF37',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 10,
    },
});
