const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../app/nin-services/index.tsx');

const content = `import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SERVICES = [
    { id: 'nin', title: 'Verify by NIN', desc: 'Find details using 11-digit NIN', icon: 'finger-print', bgColor: '#ecfdf5', iconColor: '#059669', route: '/nin-services/verify-nin' },
    { id: 'phone', title: 'Verify by Phone', desc: 'Find NIN via linked phone', icon: 'call', bgColor: '#eff6ff', iconColor: '#2563EB', route: '/nin-services/verify-phone' },
    { id: 'demo', title: 'Demographic', desc: 'Find NIN using name & DOB', icon: 'people', bgColor: '#faf5ff', iconColor: '#9333EA', route: '/nin-services/demographic' },
    { id: 'val', title: 'General Validation', desc: 'Validate NIN details', icon: 'checkmark-circle', bgColor: '#ecfeff', iconColor: '#0891B2', route: '/nin-services/validation' },
    { id: 'ipe', title: 'IPE Clearance', desc: 'Pre-Employment Clearance', icon: 'briefcase', bgColor: '#eef2ff', iconColor: '#4F46E5', route: '/nin-services/ipe-clearance' },
    { id: 'track', title: 'Card Tracking', desc: 'Check Personalization status', icon: 'card', bgColor: '#fff7ed', iconColor: '#EA580C', route: '/nin-services/tracking' },
    { id: 'delink', title: 'Delink Phone', desc: 'Remove phone from NIN', icon: 'cut', bgColor: '#fef2f2', iconColor: '#DC2626', route: '/nin-services/delink' },
    { id: 'history', title: 'NIN History', desc: 'View past verifications & reprints', icon: 'time', bgColor: '#fef9c3', iconColor: '#D97706', route: '/nin-services/history' },
];

export default function NINServicesScreen() {
    const insets = useSafeAreaInsets();

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />
            
            <LinearGradient 
                colors={['#050B14', '#0B163A']} 
                style={[styles.headerGradient, { paddingTop: insets.top + 10, paddingBottom: 50 }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                {/* Decorative Elements */}
                <View style={styles.decorator1} />
                <View style={styles.decorator2} />
                
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
                        <Ionicons name="chevron-back" size={20} color="#ffffff" />
                    </TouchableOpacity>
                    <View style={styles.secureBadge}>
                        <View style={styles.secureDot} />
                        <Text style={styles.secureText}>SECURE</Text>
                    </View>
                </View>

                <View style={styles.titleRow}>
                    <Ionicons name="shield-checkmark" size={22} color="#f5a623" />
                    <Text style={styles.titleText}>NIN Services</Text>
                </View>
                <Text style={styles.subtitleText}>National Identity Management Gateway</Text>
            </LinearGradient>

            <ScrollView style={{ flex: 1, px: 16, marginTop: -16 }} contentContainerStyle={styles.scrollContent}>
                <View style={styles.grid}>
                    {SERVICES.map((service) => (
                        <TouchableOpacity 
                            key={service.id}
                            onPress={() => router.push(service.route as any)}
                            style={styles.menuItem}
                            activeOpacity={0.8}
                        >
                            <View style={[styles.iconBox, { backgroundColor: service.bgColor }]}>
                                <Ionicons name={service.icon as any} size={20} color={service.iconColor} />
                            </View>
                            <Text style={styles.menuTitle}>{service.title}</Text>
                            <Text style={styles.menuDesc}>{service.desc}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Support Banner */}
                <View style={styles.supportBanner}>
                    <View style={styles.supportLeft}>
                        <Text style={styles.supportTitle}>Need Help?</Text>
                        <Text style={styles.supportDesc}>Contact NIMC support for issues regarding validation or modification.</Text>
                    </View>
                    <TouchableOpacity style={styles.supportButton} activeOpacity={0.8}>
                        <Ionicons name="chatbubbles" size={18} color="#050B14" />
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
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 15,
        elevation: 10,
        paddingHorizontal: 20,
        position: 'relative',
    },
    decorator1: {
        position: 'absolute',
        top: -40,
        right: -32,
        width: 128,
        height: 128,
        borderRadius: 64,
        backgroundColor: '#f5a623',
        opacity: 0.05,
    },
    decorator2: {
        position: 'absolute',
        top: 40,
        left: -32,
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: '#4F46E5',
        opacity: 0.06,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    backButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    secureBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 99,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        flexDirection: 'row',
        alignItems: 'center',
    },
    secureDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#34d399',
        marginRight: 6,
    },
    secureText: {
        color: '#ffffff',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    titleText: {
        color: '#ffffff',
        fontSize: 24,
        fontWeight: '900',
        letterSpacing: -0.5,
        marginLeft: 8,
    },
    subtitleText: {
        color: '#cbd5e1',
        fontSize: 12,
        fontWeight: '500',
        opacity: 0.9,
    },
    scrollContent: {
        paddingBottom: 100,
        paddingTop: 10,
        paddingHorizontal: 16,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    menuItem: {
        backgroundColor: '#ffffff',
        width: '48%',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        alignItems: 'flex-start',
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    menuTitle: {
        color: '#1e293b',
        fontWeight: '800',
        fontSize: 12,
        marginBottom: 4,
    },
    menuDesc: {
        color: '#64748b',
        fontSize: 10,
        lineHeight: 12,
    },
    supportBanner: {
        marginTop: 8,
        marginBottom: 24,
        backgroundColor: '#0B163A',
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    supportLeft: {
        flex: 1,
        marginRight: 16,
    },
    supportTitle: {
        color: '#ffffff',
        fontWeight: '700',
        fontSize: 14,
        marginBottom: 4,
    },
    supportDesc: {
        color: '#cbd5e1',
        fontSize: 10,
        lineHeight: 14,
    },
    supportButton: {
        backgroundColor: '#f5a623',
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
});
`;

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated index.tsx (menu) layout to use StyleSheet!');
