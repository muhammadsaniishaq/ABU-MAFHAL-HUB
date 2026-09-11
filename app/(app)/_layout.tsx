import { Tabs, useRouter, usePathname } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { View, Platform, TouchableOpacity, Text, StyleSheet, ActivityIndicator, Animated, Linking, useWindowDimensions } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SecurityModal from '../../components/SecurityModal';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import ModernTabBar from '../../components/ModernTabBar';
import WebDesktopSidebar from '../../components/WebDesktopSidebar';
import WebDesktopHeader from '../../components/WebDesktopHeader';
import { useAppSettings } from '../../hooks/useAppSettings';

const LOCK_TIMEOUT = 10 * 60 * 1000; // 10 minutes in milliseconds

export default function AppLayout() {
    const router = useRouter();
    const pathname = usePathname();
    const { settings } = useAppSettings();
    const { width } = useWindowDimensions();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [isFabOpen, setIsFabOpen] = useState(false);
    const pulseAnim = useRef(new Animated.Value(1)).current;
    usePushNotifications(); // Register for push notifications

    const isDesktopWeb = Platform.OS === 'web' && width >= 768;
    const hideFab = isDesktopWeb || pathname?.includes('transfer') || pathname?.includes('crypto') || pathname?.includes('tickets/');

    useEffect(() => {
        // AI Button Pulse Animation
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.05,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                })
            ])
        ).start();

        // Refresh timestamp to extend active session
        AsyncStorage.setItem('last_security_verification_time', String(Date.now())).catch(err => console.log(err));
    }, []);

    const tabsComponent = (
        <Tabs
            tabBar={(props) => <ModernTabBar {...props} />}
            screenOptions={{
                headerShown: false,
            }}
        >
            <Tabs.Screen name="dashboard" options={{ title: 'Home' }} />
            <Tabs.Screen name="wallet" options={{ title: 'Wallet' }} />
            <Tabs.Screen name="qr-pay" options={{ title: 'QR Pay' }} />
            <Tabs.Screen name="history" options={{ title: 'History' }} />
            <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
            
            {/* Hidden service screens - tab bar will show when these are active */}
            <Tabs.Screen name="referrals" options={{ href: null }} />
            <Tabs.Screen name="social-boost" options={{ href: null }} />
            <Tabs.Screen name="social-orders" options={{ href: null }} />
            <Tabs.Screen name="data" options={{ href: null }} />
            <Tabs.Screen name="airtime" options={{ href: null }} />
            <Tabs.Screen name="airtime-to-cash" options={{ href: null }} />
            <Tabs.Screen name="bills" options={{ href: null }} />
            <Tabs.Screen name="education" options={{ href: null }} />
            <Tabs.Screen name="bvn-services/index" options={{ href: null }} />
            <Tabs.Screen name="nin-services/index" options={{ href: null }} />
            <Tabs.Screen name="crypto" options={{ href: null, tabBarStyle: { display: 'none' } }} />
            <Tabs.Screen name="kyc" options={{ href: null }} />
            <Tabs.Screen name="virtual-cards" options={{ href: null }} />
            <Tabs.Screen name="transfer" options={{ href: null }} />
            <Tabs.Screen name="saved-cards" options={{ href: null }} />
            <Tabs.Screen name="beneficiaries" options={{ href: null }} />
            <Tabs.Screen name="support" options={{ href: null }} />
            <Tabs.Screen name="cac-services" options={{ href: null }} />
            <Tabs.Screen name="cac-history" options={{ href: null }} />
            <Tabs.Screen name="bulk-sms" options={{ href: null }} />
            <Tabs.Screen name="recharge-pin" options={{ href: null }} />
            <Tabs.Screen name="smile" options={{ href: null }} />
            <Tabs.Screen name="reviews" options={{ href: null }} />
            <Tabs.Screen name="about" options={{ href: null }} />
            <Tabs.Screen name="tickets/index" options={{ href: null }} />
            <Tabs.Screen name="tickets/[id]" options={{ href: null, tabBarStyle: { display: 'none' } }} />
        </Tabs>
    );

    const rawHidden = settings?.hidden_features;
    let hiddenFeatures: string[] = [];
    if (Array.isArray(rawHidden)) {
        hiddenFeatures = rawHidden;
    } else if (typeof rawHidden === 'string') {
        try {
            const parsed = JSON.parse(rawHidden);
            if (Array.isArray(parsed)) hiddenFeatures = parsed;
        } catch (_) {}
    }

    const ROUTE_FEATURE_MAP: Record<string, string> = {
        'transfer': 'feature_transfer',
        'airtime': 'feature_airtime',
        'recharge-pin': 'feature_airtime',
        'airtime-to-cash': 'feature_airtime',
        'data': 'feature_data',
        'bills': 'feature_bills',
        'education': 'feature_education',
        'nin-services': 'feature_nin',
        'bvn-services': 'feature_bvn',
        'cac-services': 'feature_cac',
        'cac-history': 'feature_cac',
        'virtual-cards': 'feature_cards',
        'qr-pay': 'feature_qr',
        'social-boost': 'feature_social',
        'social-orders': 'feature_social',
        'referrals': 'feature_rewards',
        'crypto': 'feature_crypto',
        'bulk-sms': 'feature_bulk_sms',
        'smile': 'feature_smile',
    };

    const activeRouteKey = Object.keys(ROUTE_FEATURE_MAP).find(key => pathname?.includes(key));
    const activeFeatureKey = activeRouteKey ? ROUTE_FEATURE_MAP[activeRouteKey] : null;
    const isCurrentRouteHidden = Boolean(activeFeatureKey && hiddenFeatures.includes(activeFeatureKey));

    const isDashboard = pathname?.includes('dashboard') || pathname === '/' || pathname === '/(app)';
    const contentMaxWidth = isDashboard ? 1280 : 920;

    const disabledServiceFallback = (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#f8fafc' }}>
            <View style={{
                maxWidth: 480,
                width: '100%',
                backgroundColor: '#ffffff',
                borderRadius: 24,
                padding: 32,
                alignItems: 'center',
                borderWidth: 1.5,
                borderColor: '#e2e8f0',
                shadowColor: '#0f172a',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.08,
                shadowRadius: 20,
                elevation: 4
            }}>
                <View style={{
                    width: 72,
                    height: 72,
                    borderRadius: 36,
                    backgroundColor: '#FEF3C7',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 18,
                    borderWidth: 2,
                    borderColor: '#FDE68A'
                }}>
                    <Ionicons name="construct-outline" size={36} color="#D97706" />
                </View>
                <Text style={{ fontSize: 20, fontWeight: '900', color: '#0F172A', textAlign: 'center', marginBottom: 8 }}>
                    Service Under Maintenance
                </Text>
                <Text style={{ fontSize: 13.5, color: '#64748B', textAlign: 'center', lineHeight: 21, marginBottom: 24 }}>
                    This service has been temporarily paused by administration for scheduled maintenance or optimization. Please check back shortly.
                </Text>
                <TouchableOpacity
                    onPress={() => router.replace('/(app)/dashboard')}
                    activeOpacity={0.85}
                    style={{
                        backgroundColor: '#0F172A',
                        paddingVertical: 14,
                        paddingHorizontal: 28,
                        borderRadius: 14,
                        width: '100%',
                        alignItems: 'center'
                    }}
                >
                    <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '800' }}>
                        ← Return to Dashboard
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    if (isDesktopWeb) {
        return (
            <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#f8fafc', minHeight: '100%' }}>
                {/* Modern Desktop Sidebar */}
                <WebDesktopSidebar 
                    collapsed={sidebarCollapsed || (width < 1024)} 
                    onToggleCollapse={() => setSidebarCollapsed(prev => !prev)} 
                />

                {/* Main Content Area */}
                <View style={{ flex: 1, flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                    <WebDesktopHeader 
                        onToggleSidebar={() => setSidebarCollapsed(prev => !prev)}
                        showToggle={width < 1024}
                    />
                    <View style={{ flex: 1, width: '100%', maxWidth: contentMaxWidth, alignSelf: 'center' }}>
                        {isCurrentRouteHidden ? disabledServiceFallback : tabsComponent}
                    </View>
                </View>
            </View>
        );
    }

    if (isCurrentRouteHidden) {
        return (
            <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
                {disabledServiceFallback}
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }}>
            {tabsComponent}

            {/* FLOATING ACTION BUTTON (FAB) */}
            {!hideFab && isFabOpen && (
                <TouchableOpacity 
                    activeOpacity={1} 
                    onPress={() => setIsFabOpen(false)}
                    style={{ backgroundColor: 'rgba(0,0,0,0.5)', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40 }}
                />
            )}
            
            {!hideFab && (
                <View pointerEvents="box-none" style={{ position: 'absolute', bottom: 72, right: 20, zIndex: 50, alignItems: 'center' }}>
                    {isFabOpen && (
                        <View style={{ alignItems: 'center', marginBottom: 12 }}>
                            <TouchableOpacity 
                                onPress={() => { setIsFabOpen(false); Linking.openURL(`whatsapp://send?phone=${settings?.support_whatsapp || '2348145853539'}`).catch(() => alert('WhatsApp not installed')); }}
                                style={{ backgroundColor: '#25D366', width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 4 }}
                            >
                                <Ionicons name="logo-whatsapp" size={20} color="#fff" />
                            </TouchableOpacity>

                            <TouchableOpacity 
                                onPress={() => { setIsFabOpen(false); router.push('/(app)/tickets'); }}
                                style={{ backgroundColor: '#e11d48', width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 4 }}
                            >
                                <Ionicons name="headset" size={20} color="#fff" />
                            </TouchableOpacity>

                            <TouchableOpacity 
                                onPress={() => { setIsFabOpen(false); router.push('/ai-chat'); }}
                                style={{ backgroundColor: '#4f46e5', width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 4 }}
                            >
                                <Ionicons name="sparkles" size={20} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    )}

                    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                        <TouchableOpacity 
                            onPress={() => setIsFabOpen(!isFabOpen)}
                            style={{ backgroundColor: '#0d1b3e', width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' }}
                        >
                            <Ionicons name={isFabOpen ? "close" : "add"} size={26} color="#fff" />
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            )}
        </View>
    );
}

const s = StyleSheet.create({
  // Floating Action Button
  fabContainer: {
    position: 'absolute',
    bottom: 90, // Positioned above the tab bar
    right: 20,
    zIndex: 999,
  },
  fab: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 12,
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  fabBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabBadgeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10b981',
  },
});
