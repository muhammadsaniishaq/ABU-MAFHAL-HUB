import { Tabs, useRouter, usePathname } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { View, Platform, TouchableOpacity, Text, StyleSheet, ActivityIndicator, Animated, Linking, useWindowDimensions, Alert } from 'react-native';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppRatingModal from '../../components/AppRatingModal';

const LOCK_TIMEOUT = 10 * 60 * 1000; // 10 minutes in milliseconds

export default function AppLayout() {
    const router = useRouter();
    const pathname = usePathname();
    const { settings } = useAppSettings();
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [isFabOpen, setIsFabOpen] = useState(false);
    const [isSocialFabOpen, setIsSocialFabOpen] = useState(false);
    const pulseAnim = useRef(new Animated.Value(1)).current;
    usePushNotifications(); // Register for push notifications

    const tabBarBottom = insets.bottom > 0
        ? insets.bottom + (Platform.OS === 'android' ? 10 : 6)
        : (Platform.OS === 'ios' ? 20 : 14);
    const fabBottom = tabBarBottom + 60 + 12;

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

    const handleOpenExternal = async (url?: string, label?: string) => {
        setIsFabOpen(false);
        setIsSocialFabOpen(false);
        if (!url || !url.trim()) {
            Alert.alert(
                'Link Not Set',
                `${label || 'This link'} has not been set by the administrator yet. Please check back later!`
            );
            return;
        }
        let target = url.trim();
        if (!target.startsWith('http://') && !target.startsWith('https://') && !target.startsWith('whatsapp://')) {
            target = `https://${target}`;
        }
        try {
            await Linking.openURL(target);
        } catch (e) {
            Alert.alert('Unable to Open', `Could not open ${label || 'link'}. Please try again later.`);
        }
    };

    const handleOpenWhatsAppChat = async () => {
        setIsFabOpen(false);
        setIsSocialFabOpen(false);
        const rawPhone = settings?.support_whatsapp || '2348145853539';
        const cleanPhone = rawPhone.replace(/[^0-9]/g, '');
        const nativeUrl = `whatsapp://send?phone=${cleanPhone}&text=Hello%20Abu%20Mafhal%20Support`;
        const webUrl = `https://wa.me/${cleanPhone}?text=Hello%20Abu%20Mafhal%20Support`;
        try {
            const canOpen = await Linking.canOpenURL(nativeUrl).catch(() => false);
            if (canOpen) {
                await Linking.openURL(nativeUrl);
            } else {
                await Linking.openURL(webUrl);
            }
        } catch {
            Linking.openURL(webUrl).catch(() => Alert.alert('Notice', 'Unable to open WhatsApp chat.'));
        }
    };

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
            
            {/* Service & transaction screens - hide bottom tab bar so submit buttons and forms are fully visible */}
            <Tabs.Screen name="referrals" options={{ href: null, tabBarStyle: { display: 'none' } }} />
            <Tabs.Screen name="social-boost" options={{ href: null, tabBarStyle: { display: 'none' } }} />
            <Tabs.Screen name="social-orders" options={{ href: null, tabBarStyle: { display: 'none' } }} />
            <Tabs.Screen name="data" options={{ href: null, tabBarStyle: { display: 'none' } }} />
            <Tabs.Screen name="airtime" options={{ href: null, tabBarStyle: { display: 'none' } }} />
            <Tabs.Screen name="airtime-to-cash" options={{ href: null, tabBarStyle: { display: 'none' } }} />
            <Tabs.Screen name="bills" options={{ href: null, tabBarStyle: { display: 'none' } }} />
            <Tabs.Screen name="education" options={{ href: null, tabBarStyle: { display: 'none' } }} />
            {/* BVN Service screens */}
            <Tabs.Screen name="bvn-services/index" options={{ href: null, tabBarStyle: { display: 'none' } }} />
            <Tabs.Screen name="bvn-services/verify" options={{ href: null, tabBarStyle: { display: 'none' } }} />
            <Tabs.Screen name="bvn-services/premium-slip" options={{ href: null, tabBarStyle: { display: 'none' } }} />
            <Tabs.Screen name="bvn-services/retrieval" options={{ href: null, tabBarStyle: { display: 'none' } }} />
            <Tabs.Screen name="bvn-services/vnin-to-nibss" options={{ href: null, tabBarStyle: { display: 'none' } }} />
            <Tabs.Screen name="bvn-services/modification" options={{ href: null, tabBarStyle: { display: 'none' } }} />
            <Tabs.Screen name="bvn-services/enrollment" options={{ href: null, tabBarStyle: { display: 'none' } }} />
            <Tabs.Screen name="bvn-services/history" options={{ href: null, tabBarStyle: { display: 'none' } }} />

            {/* NIN Service screens */}
            <Tabs.Screen name="nin-services/index" options={{ href: null, tabBarStyle: { display: 'none' } }} />
            <Tabs.Screen name="nin-services/verify-nin" options={{ href: null, tabBarStyle: { display: 'none' } }} />
            <Tabs.Screen name="nin-services/verify-phone" options={{ href: null, tabBarStyle: { display: 'none' } }} />
            <Tabs.Screen name="nin-services/demographic" options={{ href: null, tabBarStyle: { display: 'none' } }} />
            <Tabs.Screen name="nin-services/validation" options={{ href: null, tabBarStyle: { display: 'none' } }} />
            <Tabs.Screen name="nin-services/modification" options={{ href: null, tabBarStyle: { display: 'none' } }} />
            <Tabs.Screen name="nin-services/delink" options={{ href: null, tabBarStyle: { display: 'none' } }} />
            <Tabs.Screen name="nin-services/ipe-clearance" options={{ href: null, tabBarStyle: { display: 'none' } }} />
            <Tabs.Screen name="nin-services/tracking" options={{ href: null, tabBarStyle: { display: 'none' } }} />
            <Tabs.Screen name="nin-services/history" options={{ href: null, tabBarStyle: { display: 'none' } }} />
            <Tabs.Screen name="crypto" options={{ href: null, tabBarStyle: { display: 'none' } }} />
            <Tabs.Screen name="kyc" options={{ href: null, tabBarStyle: { display: 'none' } }} />
            <Tabs.Screen name="virtual-cards" options={{ href: null, tabBarStyle: { display: 'none' } }} />
            <Tabs.Screen name="transfer" options={{ href: null, tabBarStyle: { display: 'none' } }} />
            <Tabs.Screen name="saved-cards" options={{ href: null, tabBarStyle: { display: 'none' } }} />
            <Tabs.Screen name="beneficiaries" options={{ href: null, tabBarStyle: { display: 'none' } }} />
            <Tabs.Screen name="support" options={{ href: null, tabBarStyle: { display: 'none' } }} />
            <Tabs.Screen name="cac-services" options={{ href: null, tabBarStyle: { display: 'none' } }} />
            <Tabs.Screen name="cac-history" options={{ href: null, tabBarStyle: { display: 'none' } }} />
            <Tabs.Screen name="bulk-sms" options={{ href: null, tabBarStyle: { display: 'none' } }} />
            <Tabs.Screen name="recharge-pin" options={{ href: null, tabBarStyle: { display: 'none' } }} />
            <Tabs.Screen name="smile" options={{ href: null, tabBarStyle: { display: 'none' } }} />
            <Tabs.Screen name="reviews" options={{ href: null, tabBarStyle: { display: 'none' } }} />
            <Tabs.Screen name="about" options={{ href: null, tabBarStyle: { display: 'none' } }} />
            <Tabs.Screen name="tickets/index" options={{ href: null, tabBarStyle: { display: 'none' } }} />
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
                        {tabsComponent}
                        {isCurrentRouteHidden && (
                            <View style={[StyleSheet.absoluteFill, { zIndex: 100, backgroundColor: '#f8fafc' }]}>
                                {disabledServiceFallback}
                            </View>
                        )}
                    </View>
                </View>
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }}>
            {tabsComponent}

            {/* In-place maintenance overlay without destroying tab navigation */}
            {isCurrentRouteHidden && (
                <View style={[StyleSheet.absoluteFill, { zIndex: 100, backgroundColor: '#f8fafc' }]}>
                    {disabledServiceFallback}
                </View>
            )}

            {/* FLOATING ACTION BUTTON (FAB) */}
            {/* FLOATING ACTION BUTTON (FAB) BACKDROP */}
            {!hideFab && (isFabOpen || isSocialFabOpen) && (
                <TouchableOpacity 
                    activeOpacity={1} 
                    onPress={() => {
                        setIsFabOpen(false);
                        setIsSocialFabOpen(false);
                    }}
                    style={{ backgroundColor: 'rgba(0,0,0,0.5)', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40 }}
                />
            )}
            
            {!hideFab && (
                <View pointerEvents="box-none" style={{ position: 'absolute', bottom: fabBottom, right: 20, zIndex: 50, alignItems: 'flex-end' }}>
                    {/* 1. SOCIAL MEDIA SPEED-DIAL (Opens above the Social Media FAB) */}
                    {isSocialFabOpen && (
                        <View style={s.fabItemsContainer}>
                            {/* Facebook */}
                            <TouchableOpacity 
                                onPress={() => handleOpenExternal(settings?.support_facebook, 'Facebook')}
                                style={s.fabRow}
                                activeOpacity={0.8}
                            >
                                <View style={s.fabLabelBox}>
                                    <Text style={s.fabLabelText}>Facebook</Text>
                                </View>
                                <View style={[s.fabCircleBtn, { backgroundColor: '#1877F2' }]}>
                                    <Ionicons name="logo-facebook" size={20} color="#fff" />
                                </View>
                            </TouchableOpacity>

                            {/* Instagram */}
                            <TouchableOpacity 
                                onPress={() => handleOpenExternal(settings?.support_instagram, 'Instagram')}
                                style={s.fabRow}
                                activeOpacity={0.8}
                            >
                                <View style={s.fabLabelBox}>
                                    <Text style={s.fabLabelText}>Instagram</Text>
                                </View>
                                <View style={[s.fabCircleBtn, { backgroundColor: '#E4405F' }]}>
                                    <Ionicons name="logo-instagram" size={20} color="#fff" />
                                </View>
                            </TouchableOpacity>

                            {/* TikTok */}
                            <TouchableOpacity 
                                onPress={() => handleOpenExternal(settings?.support_tiktok, 'TikTok')}
                                style={s.fabRow}
                                activeOpacity={0.8}
                            >
                                <View style={s.fabLabelBox}>
                                    <Text style={s.fabLabelText}>TikTok</Text>
                                </View>
                                <View style={[s.fabCircleBtn, { backgroundColor: '#000000' }]}>
                                    <Ionicons name="logo-tiktok" size={18} color="#fff" />
                                </View>
                            </TouchableOpacity>

                            {/* Twitter (X) */}
                            <TouchableOpacity 
                                onPress={() => handleOpenExternal(settings?.support_twitter, 'Twitter (X)')}
                                style={s.fabRow}
                                activeOpacity={0.8}
                            >
                                <View style={s.fabLabelBox}>
                                    <Text style={s.fabLabelText}>Twitter (X)</Text>
                                </View>
                                <View style={[s.fabCircleBtn, { backgroundColor: '#0F172A' }]}>
                                    <Ionicons name="logo-twitter" size={18} color="#fff" />
                                </View>
                            </TouchableOpacity>

                            {/* Telegram */}
                            <TouchableOpacity 
                                onPress={() => handleOpenExternal(settings?.support_telegram, 'Telegram')}
                                style={s.fabRow}
                                activeOpacity={0.8}
                            >
                                <View style={s.fabLabelBox}>
                                    <Text style={s.fabLabelText}>Telegram</Text>
                                </View>
                                <View style={[s.fabCircleBtn, { backgroundColor: '#0088CC' }]}>
                                    <Ionicons name="paper-plane" size={18} color="#fff" />
                                </View>
                            </TouchableOpacity>

                            {/* YouTube */}
                            <TouchableOpacity 
                                onPress={() => handleOpenExternal(settings?.support_youtube, 'YouTube')}
                                style={s.fabRow}
                                activeOpacity={0.8}
                            >
                                <View style={s.fabLabelBox}>
                                    <Text style={s.fabLabelText}>YouTube</Text>
                                </View>
                                <View style={[s.fabCircleBtn, { backgroundColor: '#FF0000' }]}>
                                    <Ionicons name="logo-youtube" size={18} color="#fff" />
                                </View>
                            </TouchableOpacity>

                            {/* LinkedIn */}
                            <TouchableOpacity 
                                onPress={() => handleOpenExternal(settings?.support_linkedin, 'LinkedIn')}
                                style={s.fabRow}
                                activeOpacity={0.8}
                            >
                                <View style={s.fabLabelBox}>
                                    <Text style={s.fabLabelText}>LinkedIn</Text>
                                </View>
                                <View style={[s.fabCircleBtn, { backgroundColor: '#0A66C2' }]}>
                                    <Ionicons name="logo-linkedin" size={18} color="#fff" />
                                </View>
                            </TouchableOpacity>

                            {/* WhatsApp Direct */}
                            <TouchableOpacity 
                                onPress={handleOpenWhatsAppChat}
                                style={s.fabRow}
                                activeOpacity={0.8}
                            >
                                <View style={s.fabLabelBox}>
                                    <Text style={s.fabLabelText}>WhatsApp Chat</Text>
                                </View>
                                <View style={[s.fabCircleBtn, { backgroundColor: '#25D366' }]}>
                                    <Ionicons name="logo-whatsapp" size={20} color="#fff" />
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* TOP BUTTON: SOCIAL MEDIA PLUS (Placed directly above the Support Plus) */}
                    <View style={{ marginBottom: 10 }}>
                        <TouchableOpacity 
                            onPress={() => {
                                setIsFabOpen(false);
                                setIsSocialFabOpen(!isSocialFabOpen);
                            }}
                            activeOpacity={0.85}
                            style={s.socialFabBtn}
                        >
                            <LinearGradient 
                                colors={isSocialFabOpen ? ['#475569', '#1E293B'] : ['#8B5CF6', '#EC4899']} 
                                start={{ x: 0, y: 0 }} 
                                end={{ x: 1, y: 1 }} 
                                style={s.socialFabInner}
                            >
                                <Ionicons name={isSocialFabOpen ? "close" : "add"} size={26} color="#fff" />
                                {!isSocialFabOpen && (
                                    <View style={s.socialFabBadge}>
                                        <Ionicons name="share-social" size={10} color="#EC4899" />
                                    </View>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>

                    {/* 2. CUSTOMER SUPPORT SPEED-DIAL (Opens above the Support FAB) */}
                    {isFabOpen && (
                        <View style={s.fabItemsContainer}>
                            {/* WhatsApp Group */}
                            <TouchableOpacity 
                                onPress={() => handleOpenExternal(settings?.support_whatsapp_group || settings?.whatsapp_group_link, 'WhatsApp Group')}
                                style={s.fabRow}
                                activeOpacity={0.8}
                            >
                                <View style={s.fabLabelBox}>
                                    <Text style={s.fabLabelText}>WhatsApp Group</Text>
                                </View>
                                <View style={[s.fabCircleBtn, { backgroundColor: '#128C7E' }]}>
                                    <Ionicons name="people" size={20} color="#fff" />
                                </View>
                            </TouchableOpacity>

                            {/* WhatsApp Channel */}
                            <TouchableOpacity 
                                onPress={() => handleOpenExternal(settings?.support_whatsapp_channel || settings?.whatsapp_channel_link, 'WhatsApp Channel')}
                                style={s.fabRow}
                                activeOpacity={0.8}
                            >
                                <View style={s.fabLabelBox}>
                                    <Text style={s.fabLabelText}>WhatsApp Channel</Text>
                                </View>
                                <View style={[s.fabCircleBtn, { backgroundColor: '#25D366' }]}>
                                    <Ionicons name="megaphone" size={18} color="#fff" />
                                </View>
                            </TouchableOpacity>

                            {/* WhatsApp Direct Chat */}
                            <TouchableOpacity 
                                onPress={handleOpenWhatsAppChat}
                                style={s.fabRow}
                                activeOpacity={0.8}
                            >
                                <View style={s.fabLabelBox}>
                                    <Text style={s.fabLabelText}>WhatsApp Support</Text>
                                </View>
                                <View style={[s.fabCircleBtn, { backgroundColor: '#25D366' }]}>
                                    <Ionicons name="logo-whatsapp" size={20} color="#fff" />
                                </View>
                            </TouchableOpacity>

                            {/* Support Tickets */}
                            <TouchableOpacity 
                                onPress={() => { setIsFabOpen(false); router.push('/(app)/tickets'); }}
                                style={s.fabRow}
                                activeOpacity={0.8}
                            >
                                <View style={s.fabLabelBox}>
                                    <Text style={s.fabLabelText}>Customer Tickets</Text>
                                </View>
                                <View style={[s.fabCircleBtn, { backgroundColor: '#e11d48' }]}>
                                    <Ionicons name="headset" size={20} color="#fff" />
                                </View>
                            </TouchableOpacity>

                            {/* AI Assistant */}
                            <TouchableOpacity 
                                onPress={() => { setIsFabOpen(false); router.push('/ai-chat'); }}
                                style={s.fabRow}
                                activeOpacity={0.8}
                            >
                                <View style={s.fabLabelBox}>
                                    <Text style={s.fabLabelText}>AI Assistant</Text>
                                </View>
                                <View style={[s.fabCircleBtn, { backgroundColor: '#4f46e5' }]}>
                                    <Ionicons name="sparkles" size={20} color="#fff" />
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* BOTTOM BUTTON: SUPPORT & COMMUNITY PLUS FAB */}
                    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                        <TouchableOpacity 
                            onPress={() => {
                                setIsSocialFabOpen(false);
                                setIsFabOpen(!isFabOpen);
                            }}
                            style={{ backgroundColor: '#0d1b3e', width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' }}
                        >
                            <Ionicons name={isFabOpen ? "close" : "add"} size={26} color="#fff" />
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            )}

            {/* In-App Google Play Rating & Feedback Modal */}
            <AppRatingModal customPlayStoreUrl={settings?.play_store_url} />
        </View>
    );
}

const s = StyleSheet.create({
  fabItemsContainer: {
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  fabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  fabLabelBox: {
    backgroundColor: '#ffffff',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  fabLabelText: {
    color: '#0f172a',
    fontSize: 12.5,
    fontWeight: '700',
  },
  fabCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  socialFabBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  socialFabInner: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    position: 'relative',
  },
  socialFabBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    borderColor: '#EC4899',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
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
