import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SERVICES = [
    { id: 'nin', title: 'Verify NIN', desc: 'Premium, Standard & Regular Slips', icon: 'finger-print-outline', route: '/nin-services/verify-nin' },
    { id: 'mod', title: 'NIN Modification', desc: 'Change Name, Phone, or Address', icon: 'create-outline', route: '/nin-services/modification' },
    { id: 'bvn', title: 'BVN Validation', desc: 'Verify & generate BVN cards', icon: 'card-outline', route: '/nin-services/validation' },
    { id: 'phone', title: 'Verify by Phone', desc: 'Find NIN via linked phone', icon: 'call-outline', route: '/nin-services/verify-phone' },
    { id: 'demo', title: 'Demographic Search', desc: 'Lookup NIN by Name & DOB', icon: 'people-outline', route: '/nin-services/demographic' },
    { id: 'val', title: 'NIN Validation', desc: 'Resolve no-record errors', icon: 'checkmark-circle-outline', route: '/nin-services/validation' },
    { id: 'ipe', title: 'IPE Clearance', desc: 'Pre-employment verification', icon: 'briefcase-outline', route: '/nin-services/ipe-clearance' },
    { id: 'track', title: 'Personalization', desc: 'Check status & tracking ID', icon: 'shield-checkmark-outline', route: '/nin-services/tracking' },
    { id: 'delink', title: 'Delink Phone', desc: 'Remove phone from NIN record', icon: 'cut-outline', route: '/nin-services/delink' },
    { id: 'history', title: 'NIN History', desc: 'View past logs & reprints', icon: 'time-outline', route: '/nin-services/history' },
];

export default function NINServicesScreen() {
    const insets = useSafeAreaInsets();

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
                        <View style={styles.secureDot} />
                        <Text style={styles.secureText}>NIMC VERIFIED</Text>
                    </View>
                </View>

                <View style={styles.titleRow}>
                    <Ionicons name="shield-checkmark" size={20} color="#D4AF37" />
                    <Text style={styles.titleText}>NIN Services</Text>
                </View>
                <Text style={styles.subtitleText}>National Identity Management Gateway</Text>
            </LinearGradient>

            <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
                <View style={styles.grid}>
                    {SERVICES.map((service) => (
                        <TouchableOpacity 
                            key={service.id}
                            onPress={() => router.push(service.route as any)}
                            style={styles.menuItem}
                            activeOpacity={0.8}
                        >
                            <View style={styles.menuHeader}>
                                <View style={styles.iconBox}>
                                    <Ionicons name={service.icon as any} size={18} color="#D4AF37" />
                                </View>
                                <Ionicons name="chevron-forward" size={14} color="#94a3b8" />
                            </View>
                            <Text style={styles.menuTitle} numberOfLines={1}>{service.title}</Text>
                            <Text style={styles.menuDesc} numberOfLines={1}>{service.desc}</Text>
                        </TouchableOpacity>
                    ))}
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
        backgroundColor: 'rgba(212,175,55,0.12)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.3)',
    },
    secureDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#D4AF37',
        marginRight: 5,
    },
    secureText: {
        color: '#D4AF37',
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    titleText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '900',
    },
    subtitleText: {
        color: '#94a3b8',
        fontSize: 11,
        marginTop: 2,
        marginBottom: 4,
    },
    content: {
        flex: 1,
        paddingHorizontal: 14,
        marginTop: 8,
    },
    scrollContent: {
        paddingBottom: 30,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    menuItem: {
        width: '48.5%',
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
    },
    menuHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    iconBox: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#FEF9E7',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.25)',
    },
    menuTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#0B192C',
        marginBottom: 2,
    },
    menuDesc: {
        fontSize: 10,
        color: '#64748b',
    },
    supportBanner: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 12,
        marginTop: 6,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    supportLeft: {
        flex: 1,
        marginRight: 10,
    },
    supportTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#0B192C',
    },
    supportDesc: {
        fontSize: 10,
        color: '#64748b',
        marginTop: 1,
    },
    supportButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#D4AF37',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
