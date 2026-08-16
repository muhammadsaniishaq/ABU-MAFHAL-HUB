import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Dimensions,
  StyleSheet,
  Animated,
  Easing,
  ScrollView,
  Platform,
  useWindowDimensions,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { supabase, processOAuthReturn } from '../services/supabase';
import { useAppSettings } from '../hooks/useAppSettings';
import Mascot3D from '../components/Mascot3D';

export default function LandingPage() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const router = useRouter();
  const { ref } = useLocalSearchParams<{ ref?: string }>();
  const { settings } = useAppSettings();

  const [partners, setPartners] = useState<any[]>([]);
  const scrollAnim = useRef(new Animated.Value(0)).current;

  // 1. Session Auto-Detection & OAuth Return Exchange
  useEffect(() => {
    let isSubscribed = true;

    const checkSessionAndNavigate = async () => {
      try {
        await processOAuthReturn();

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && isSubscribed) {
          await AsyncStorage.setItem('has_active_session', 'true');

          let localPin = Platform.OS === 'web'
            ? await AsyncStorage.getItem('user_transaction_pin')
            : await SecureStore.getItemAsync('user_transaction_pin');

          if (!localPin) {
            const { data } = await supabase
              .from('profiles')
              .select('transaction_pin')
              .eq('id', session.user.id)
              .maybeSingle();

            if (data?.transaction_pin) {
              localPin = data.transaction_pin;
              if (Platform.OS === 'web') await AsyncStorage.setItem('user_transaction_pin', localPin as string);
              else await SecureStore.setItemAsync('user_transaction_pin', localPin as string);
            }
          }

          const unlocked = await AsyncStorage.getItem('app_unlocked');

          if (!localPin) {
            router.replace('/pin-setup' as any);
          } else if (unlocked === 'true') {
            router.replace('/dashboard' as any);
          } else {
            router.replace('/pin' as any);
          }
        } else if (Platform.OS === 'web' && typeof window !== 'undefined' && isSubscribed) {
          if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
            window.location.replace('/landing.html');
          }
        }
      } catch (e) {
        console.log('Landing session check notice:', e);
      }
    };

    checkSessionAndNavigate();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user && isSubscribed) {
        checkSessionAndNavigate();
      }
    });

    return () => {
      isSubscribed = false;
      subscription.unsubscribe();
    };
  }, []);

  // 2. Fetch Partners & Referral Link handling
  useEffect(() => {
    if (ref) {
      router.replace(`/(auth)/signup?ref=${ref}`);
      return;
    }

    const fetchPartners = async () => {
      try {
        const { data } = await supabase
          .from('partners')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });
        if (data && data.length > 0) setPartners(data);
      } catch (e) {}
    };
    fetchPartners();
  }, [ref]);

  // Partners marquee animation
  useEffect(() => {
    if (partners.length > 0) {
      scrollAnim.setValue(0);
      const anim = Animated.loop(
        Animated.timing(scrollAnim, {
          toValue: 1,
          duration: Math.max(10000, partners.length * 5000),
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      anim.start();
      return () => anim.stop();
    }
  }, [partners.length]);

  const translateX = scrollAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [width, -width * 3]
  });

  return (
    <View style={s.container}>
      <StatusBar style="light" />
      
      {/* Royal Navy Gradient */}
      <LinearGradient colors={['#020617', '#0F172A', '#020617']} style={StyleSheet.absoluteFillObject} />

      {/* Decorative Glow Effects */}
      <View style={s.topGlow} />
      <View style={s.bottomGlow} />

      <SafeAreaView style={{ flex: 1 }}>
        
        {/* Navigation Header Bar */}
        <View style={[s.navbar, isDesktop && s.desktopNavbar]}>
          <View style={s.brandRow}>
            <Image
              source={(settings?.app_logo ? { uri: typeof settings.app_logo === 'string' ? settings.app_logo : settings.app_logo.url } : require('../assets/images/logo.png'))}
              style={s.logoImage}
              resizeMode="contain"
            />
            <View style={{ marginLeft: 8 }}>
              <Text style={s.brandTitle}>ABUMAFHAL</Text>
              <Text style={s.brandSub}>FINTECH & DIGITAL HUB</Text>
            </View>
          </View>

          {/* Security Badge */}
          <View style={s.securityBadge}>
            <Ionicons name="shield-checkmark" size={12} color="#F59E0B" />
            <Text style={s.securityBadgeText}>256-BIT SSL SECURED</Text>
          </View>

          {/* Top Auth Buttons */}
          <View style={s.navButtonsRow}>
            <TouchableOpacity 
              onPress={() => router.push('/login' as any)} 
              style={s.signInOutlineBtn}
              activeOpacity={0.8}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={s.signInOutlineBtnText}>Sign In</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => router.push('/signup' as any)} 
              style={s.registerGoldBtn}
              activeOpacity={0.85}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <LinearGradient colors={['#F59E0B', '#D97706']} style={s.registerGoldBtnGradient}>
                <Text style={s.registerGoldBtnText}>Get Started</Text>
                <Ionicons name="arrow-forward" size={14} color="#0F172A" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Scrollable Landing Content */}
        <ScrollView 
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Main Hero Card Container */}
          <View style={[s.heroContainer, isDesktop && s.desktopHeroContainer]}>
            
            {/* Mascot & Welcome Badge */}
            <View style={s.mascotWrapper}>
              <Mascot3D size={isDesktop ? 120 : 95} greetingText="Welcome to ABU MAFHAL! 👋" isDarkMode={true} />
            </View>

            {/* Hero Main Headline */}
            <View style={s.headlineBox}>
              <View style={s.badgePill}>
                <Ionicons name="sparkles" size={11} color="#F59E0B" style={{ marginRight: 4 }} />
                <Text style={s.badgePillText}>Nigeria's #1 Automated VTU & Telecom Hub</Text>
              </View>

              <Text style={[s.heroTitle, isDesktop && s.desktopHeroTitle]}>
                One Sub <Text style={{ color: '#F59E0B' }}>.</Text> Endless Possibilities <Text style={{ color: '#F59E0B' }}>!</Text>
              </Text>
              
              <Text style={s.heroSub}>
                Instant cheap data bundles, airtime top-up, electricity bill payment & cable TV subscriptions delivered in 0.1 seconds.
              </Text>

              {/* Feature Pills Row */}
              <View style={s.featurePillsRow}>
                <View style={[s.pillItem, { borderColor: '#F59E0B', backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
                  <Text style={[s.pillText, { color: '#FDE047' }]}>🎁 ₦500 Bonus</Text>
                </View>
                <View style={[s.pillItem, { borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                  <Text style={[s.pillText, { color: '#6EE7B7' }]}>🔒 100% Automated</Text>
                </View>
                <View style={[s.pillItem, { borderColor: '#3B82F6', backgroundColor: 'rgba(59, 130, 246, 0.12)' }]}>
                  <Text style={[s.pillText, { color: '#93C5FD' }]}>💎 Wholesale Prices</Text>
                </View>
              </View>
            </View>

            {/* Primary Action Hero Buttons */}
            <View style={[s.heroActionRow, isDesktop && s.desktopHeroActionRow]}>
              <TouchableOpacity 
                onPress={() => router.push('/signup' as any)}
                style={s.heroPrimaryBtn}
                activeOpacity={0.88}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <LinearGradient colors={['#F59E0B', '#B45309']} style={s.heroPrimaryBtnGradient}>
                  <Text style={s.heroPrimaryBtnText}>Create Free Account</Text>
                  <Ionicons name="chevron-forward-circle" size={18} color="#0F172A" />
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => router.push('/login' as any)}
                style={s.heroSecondaryBtn}
                activeOpacity={0.8}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="log-in-outline" size={18} color="#F59E0B" style={{ marginRight: 6 }} />
                <Text style={s.heroSecondaryBtnText}>Sign In to Account</Text>
              </TouchableOpacity>
            </View>

          </View>

          {/* Services Grid Section */}
          <View style={s.sectionContainer}>
            <View style={s.sectionHeaderBox}>
              <Text style={s.sectionSubtitle}>OUR SERVICES</Text>
              <Text style={s.sectionTitle}>Everything You Need In One App</Text>
            </View>

            <View style={s.servicesGrid}>
              
              {/* Card 1: Airtime Topup */}
              <View style={s.serviceCard}>
                <View style={[s.serviceIconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: '#F59E0B' }]}>
                  <Ionicons name="phone-portrait" size={20} color="#F59E0B" />
                </View>
                <Text style={s.serviceCardTitle}>Airtime Top-Up</Text>
                <Text style={s.serviceCardSub}>Instant airtime recharge for MTN, Airtel, Glo & 9mobile with up to 3% discount.</Text>
              </View>

              {/* Card 2: Cheap Data Bundles */}
              <View style={s.serviceCard}>
                <View style={[s.serviceIconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: '#10B981' }]}>
                  <Ionicons name="wifi" size={20} color="#10B981" />
                </View>
                <Text style={s.serviceCardTitle}>Data Bundles</Text>
                <Text style={s.serviceCardSub}>Super cheap SME, Gifting & Direct data with 30-day validity starting at ₦220/GB.</Text>
              </View>

              {/* Card 3: Electricity Bills */}
              <View style={s.serviceCard}>
                <View style={[s.serviceIconCircle, { backgroundColor: 'rgba(59, 130, 246, 0.15)', borderColor: '#3B82F6' }]}>
                  <Ionicons name="flash" size={20} color="#3B82F6" />
                </View>
                <Text style={s.serviceCardTitle}>Electricity Tokens</Text>
                <Text style={s.serviceCardSub}>Pay prepaid & postpaid electricity bills for IKEDC, EKEDC, AEDC, IBEDC & get instant tokens.</Text>
              </View>

              {/* Card 4: Cable TV Subscriptions */}
              <View style={s.serviceCard}>
                <View style={[s.serviceIconCircle, { backgroundColor: 'rgba(168, 85, 247, 0.15)', borderColor: '#A855F7' }]}>
                  <Ionicons name="tv" size={20} color="#A855F7" />
                </View>
                <Text style={s.serviceCardTitle}>Cable TV Renewals</Text>
                <Text style={s.serviceCardSub}>Instant renewal for DSTV, GOTV & Startimes with zero convenience fees.</Text>
              </View>

              {/* Card 5: Virtual Bank Accounts */}
              <View style={s.serviceCard}>
                <View style={[s.serviceIconCircle, { backgroundColor: 'rgba(236, 72, 153, 0.15)', borderColor: '#EC4899' }]}>
                  <Ionicons name="wallet" size={20} color="#EC4899" />
                </View>
                <Text style={s.serviceCardTitle}>Virtual Accounts</Text>
                <Text style={s.serviceCardSub}>Get your dedicated Wema, Moniepoint & Sterling accounts for 24/7 instant wallet funding.</Text>
              </View>

              {/* Card 6: Refer & Earn Rewards */}
              <View style={s.serviceCard}>
                <View style={[s.serviceIconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: '#F59E0B' }]}>
                  <Ionicons name="gift" size={20} color="#F59E0B" />
                </View>
                <Text style={s.serviceCardTitle}>Refer & Earn ₦500</Text>
                <Text style={s.serviceCardSub}>Invite your friends with your custom link and earn instant cash bonuses directly into your wallet.</Text>
              </View>

            </View>
          </View>

          {/* Why Choose Us Section */}
          <View style={s.whyUsContainer}>
            <Text style={s.sectionSubtitle}>WHY CHOOSE ABU MAFHAL</Text>
            <Text style={s.sectionTitle}>Built For Speed, Reliability & Security</Text>

            <View style={s.whyUsGrid}>
              <View style={s.whyUsItem}>
                <Ionicons name="speedometer-outline" size={24} color="#F59E0B" />
                <Text style={s.whyUsItemTitle}>0.1s Instant Delivery</Text>
                <Text style={s.whyUsItemSub}>All orders are processed automatically by automated API servers.</Text>
              </View>

              <View style={s.whyUsItem}>
                <Ionicons name="lock-closed-outline" size={24} color="#10B981" />
                <Text style={s.whyUsItemTitle}>Bank-Grade Security</Text>
                <Text style={s.whyUsItemSub}>256-Bit SSL encryption & 4-digit transaction PIN protection.</Text>
              </View>

              <View style={s.whyUsItem}>
                <Ionicons name="headset-outline" size={24} color="#3B82F6" />
                <Text style={s.whyUsItemTitle}>24/7 Dedicated Support</Text>
                <Text style={s.whyUsItemSub}>Live WhatsApp & phone support team available around the clock.</Text>
              </View>
            </View>
          </View>

          {/* Partners Marquee Ticker */}
          {partners.length > 0 && (
            <View style={s.partnersContainer}>
              <Text style={s.partnersTitle}>OFFICIAL TELECOM & PAYMENT PARTNERS</Text>
              <Animated.View style={{ overflow: 'hidden', height: 44, width: '100%' }}>
                <Animated.View style={{ flexDirection: 'row', transform: [{ translateX }] }}>
                  {[...partners, ...partners, ...partners].map((p, i) => (
                    <View key={i} style={s.partnerBadge}>
                      {p.logo_url ? (
                        <Image source={{ uri: p.logo_url }} style={s.partnerLogo} resizeMode="contain" />
                      ) : (
                        <Ionicons name="business" size={16} color="#F59E0B" style={{ marginRight: 6 }} />
                      )}
                      <Text style={s.partnerText}>{p.name}</Text>
                    </View>
                  ))}
                </Animated.View>
              </Animated.View>
            </View>
          )}

          {/* Footer Bar */}
          <View style={s.footerContainer}>
            <View style={s.footerBrandRow}>
              <Text style={s.footerBrandTitle}>ABU MAFHAL SUB</Text>
              <Text style={s.footerBrandSub}>© 2026 ABU MAFHAL HUB. All rights reserved.</Text>
            </View>

            <View style={s.footerLinksRow}>
              <TouchableOpacity onPress={() => router.push('/privacy')} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={s.footerLinkText}>Privacy Policy</Text>
              </TouchableOpacity>
              <Text style={{ color: '#64748B' }}>•</Text>
              <TouchableOpacity onPress={() => router.push('/terms')} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={s.footerLinkText}>Terms of Service</Text>
              </TouchableOpacity>
              <Text style={{ color: '#64748B' }}>•</Text>
              <TouchableOpacity onPress={() => router.push('/login')} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={s.footerLinkText}>Account Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  topGlow: {
    position: 'absolute',
    top: -120,
    alignSelf: 'center',
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  bottomGlow: {
    position: 'absolute',
    bottom: -120,
    alignSelf: 'center',
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  desktopNavbar: {
    paddingHorizontal: 40,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoImage: {
    width: 32,
    height: 32,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  brandSub: {
    color: '#F59E0B',
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 1,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: '#F59E0B',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  securityBadgeText: {
    color: '#F59E0B',
    fontSize: 8.5,
    fontWeight: '800',
    marginLeft: 3,
  },
  navButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  signInOutlineBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  signInOutlineBtnText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '700',
  },
  registerGoldBtn: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  registerGoldBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  registerGoldBtnText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '900',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
  },
  desktopHeroContainer: {
    maxWidth: 900,
    alignSelf: 'center',
    paddingTop: 40,
  },
  mascotWrapper: {
    marginBottom: 12,
  },
  headlineBox: {
    alignItems: 'center',
    textAlign: 'center',
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginBottom: 10,
  },
  badgePillText: {
    color: '#F59E0B',
    fontSize: 10.5,
    fontWeight: '800',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  desktopHeroTitle: {
    fontSize: 38,
    lineHeight: 46,
  },
  heroSub: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
    maxWidth: 520,
  },
  featurePillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  pillItem: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '900',
  },
  heroActionRow: {
    width: '100%',
    maxWidth: 380,
    gap: 10,
    marginTop: 24,
  },
  desktopHeroActionRow: {
    flexDirection: 'row',
    maxWidth: 460,
  },
  heroPrimaryBtn: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  heroPrimaryBtnGradient: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  heroPrimaryBtnText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '900',
    marginRight: 6,
  },
  heroSecondaryBtn: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  heroSecondaryBtnText: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '800',
  },
  sectionContainer: {
    paddingHorizontal: 20,
    paddingVertical: 30,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderColor: 'rgba(245, 158, 11, 0.15)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  sectionHeaderBox: {
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionSubtitle: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  serviceCard: {
    width: Platform.OS === 'web' ? 280 : '47%',
    backgroundColor: '#0F172A',
    borderColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  serviceIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  serviceCardTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  serviceCardSub: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 15,
  },
  whyUsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 30,
    alignItems: 'center',
  },
  whyUsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 20,
    justifyContent: 'center',
  },
  whyUsItem: {
    width: Platform.OS === 'web' ? 260 : '100%',
    backgroundColor: '#0F172A',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    textAlign: 'center',
  },
  whyUsItemTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 4,
  },
  whyUsItemSub: {
    color: '#94A3B8',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 15,
  },
  partnersContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  partnersTitle: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  partnerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 16,
  },
  partnerLogo: {
    width: 18,
    height: 18,
    borderRadius: 4,
    marginRight: 6,
  },
  partnerText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  footerContainer: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderTopWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
    alignItems: 'center',
    gap: 12,
  },
  footerBrandRow: {
    alignItems: 'center',
  },
  footerBrandTitle: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  footerBrandSub: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 2,
  },
  footerLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  footerLinkText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
});
