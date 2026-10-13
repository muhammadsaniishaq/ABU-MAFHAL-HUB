import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Platform,
  StatusBar,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { supabase, processOAuthReturn } from '../services/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SW, height: SH } = Dimensions.get('window');

const SLIDES = [
  {
    image: require('../assets/images/splash_hero_character.gif'),
    title: 'Instant 5G Data & Airtime',
    subtitle: 'Buy cheap data bundles and airtime at wholesale prices with instant automated delivery.',
    features: [
      { icon: '📶', title: 'All 4 Networks Supported', desc: 'MTN, Airtel, Glo & 9mobile recharged in seconds' },
      { icon: '💰', title: 'Wholesale SME Packages', desc: 'Direct wholesale rates starting from ₦240 per GB' },
      { icon: '⚡', title: '0-Second Automated Delivery', desc: 'Real-time API processing with 99.98% uptime' },
    ],
  },
  {
    image: require('../assets/images/splash_hero_character2.gif'),
    title: 'Dedicated Bank Accounts',
    subtitle: 'Personal Nigerian bank accounts for zero-fee, instant automated wallet funding.',
    features: [
      { icon: '🏦', title: 'Personal Account Numbers', desc: 'Dedicated Moniepoint & Wema Bank accounts in your name' },
      { icon: '⚡', title: 'Instant 0s Auto-Credit', desc: 'Wallet is credited immediately with 0% deposit charge' },
      { icon: '🔒', title: 'Bank-Grade Security', desc: '256-bit SSL encrypted & NDPA certified compliance' },
    ],
  },
  {
    image: require('../assets/images/splash_hero_character3.gif'),
    title: 'Sit Back & Relax',
    subtitle: 'Automate utility bills, TV renewals and resell VTU services for daily income.',
    features: [
      { icon: '💡', title: 'Prepaid Electricity Tokens', desc: 'Instant meter tokens for AEDC, EKEDC, IBEDC & more' },
      { icon: '📺', title: 'Cable TV Subscriptions', desc: 'Instant renewal for DStv, GOtv, Startimes & Showmax' },
      { icon: '📈', title: 'Lucrative Reseller Profits', desc: 'Save money on personal use or resell to earn daily profits' },
    ],
  },
];

export default function SplashScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [pageIdx, setPageIdx] = useState(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  // Floating mascot animation (smooth & peaceful)
  const floatY = useSharedValue(0);

  // Transition animations
  const slideOpacity = useSharedValue(1);
  const slideScale = useSharedValue(1);

  useEffect(() => {
    checkAuthSession();

    // Gentle floating (3.6s cycle)
    floatY.value = withRepeat(
      withSequence(
        withTiming(-7, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true
    );
  }, []);

  useEffect(() => {
    slideOpacity.value = 0.35;
    slideScale.value = 0.95;
    slideOpacity.value = withTiming(1, { duration: 340, easing: Easing.out(Easing.cubic) });
    slideScale.value = withSpring(1, { damping: 16, stiffness: 120 });
  }, [pageIdx]);

  const floatAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  const slideAnimStyle = useAnimatedStyle(() => ({
    opacity: slideOpacity.value,
    transform: [{ scale: slideScale.value }],
  }));

  const checkAuthSession = async () => {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const search = window.location.search || '', hash = window.location.hash || '';
        const hasAuth = (hash && hash.includes('access_token')) || (search && search.includes('code='));
        if (hasAuth) {
          const ua = (window.navigator?.userAgent || '').toLowerCase();
          if (/android|iphone|ipad|ipod/.test(ua)) {
            window.location.href = `abumafhalsub://login${search}${hash}`;
            router.replace('/auth/callback' as any);
            return;
          }
          await processOAuthReturn();
        }
      }
      let { data: { session } } = await supabase.auth.getSession();
      if (!session && Platform.OS === 'web') {
        const hasActive = await AsyncStorage.getItem('has_active_session');
        if (hasActive === 'true') {
          await new Promise(resolve => setTimeout(resolve, 600));
          const retryResult = await supabase.auth.getSession();
          session = retryResult.data.session;
        }
      }
      if (session?.user) {
        await AsyncStorage.setItem('has_active_session', 'true');
        await AsyncStorage.setItem('app_unlocked', 'true');
        const isPreview = Platform.OS === 'web' && typeof window !== 'undefined' && (
          window.location.search.includes('preview') || window.location.search.includes('splash')
        );
        if (!isPreview) {
          setTimeout(() => router.replace('/dashboard' as any), 600);
        }
      } else {
        await AsyncStorage.removeItem('has_active_session');
        await AsyncStorage.removeItem('app_unlocked');
      }
    } catch {}
  };

  const haptic = useCallback(() => {
    if (Platform.OS !== 'web') {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    }
  }, []);

  const goTo = (idx: number) => {
    haptic();
    setPageIdx(idx);
  };

  const nextSlide = () => {
    haptic();
    if (pageIdx < 2) {
      setPageIdx(p => p + 1);
    } else {
      router.push('/(auth)/signup' as any);
    }
  };

  const prevSlide = () => {
    haptic();
    if (pageIdx > 0) {
      setPageIdx(p => p - 1);
    }
  };

  const skipAll = () => {
    haptic();
    setPageIdx(2);
  };

  const handleTouchStart = (e: any) => {
    touchStartX.current = e.nativeEvent.pageX;
    touchStartY.current = e.nativeEvent.pageY;
  };

  const handleTouchEnd = (e: any) => {
    const dx = e.nativeEvent.pageX - touchStartX.current;
    const dy = e.nativeEvent.pageY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      dx < 0 ? nextSlide() : prevSlide();
    }
  };

  const currentSlide = SLIDES[pageIdx] || SLIDES[0];

  return (
    <View
      style={[
        styles.screen,
        {
          paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 44 : 24) + 6,
          paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 34 : 20) + 12,
        },
      ]}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* TOP NAVIGATION: BACK ARROW & SKIP */}
      <View style={styles.topNav}>
        {pageIdx > 0 ? (
          <TouchableOpacity onPress={prevSlide} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-back" size={20} color="#334155" />
          </TouchableOpacity>
        ) : (
          <View style={styles.backPlaceholder} />
        )}

        {pageIdx < 2 ? (
          <TouchableOpacity onPress={skipAll} style={styles.skipBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.skipTxt}>Skip</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backPlaceholder} />
        )}
      </View>

      {/* SCROLLABLE MAIN BODY FOR CLEAN SCALING ON ALL PHONES */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.mainSection, slideAnimStyle]}>
          
          {/* MASCOT SECTION WITH CRISP SHAPE (ZERO BLUR FILTER) */}
          <View style={styles.mascotSection}>
            <View style={styles.crispBackdropShape} />
            <View style={styles.crispGroundOval} />
            
            <Animated.View style={[styles.mascotWrap, floatAnimStyle]}>
              <Image
                key={`slide-img-${pageIdx}`}
                source={currentSlide.image}
                style={styles.mascotImg}
                resizeMode="contain"
              />
            </Animated.View>
          </View>

          {/* HEADINGS */}
          <View style={styles.textSection}>
            <Text style={styles.title}>{currentSlide.title}</Text>
            <Text style={styles.subtitle}>{currentSlide.subtitle}</Text>
          </View>

          {/* NEAT STRUCTURED FEATURES LIST ("FEATURES KE TSARI") */}
          <View style={styles.featuresList}>
            {currentSlide.features.map((feat, idx) => (
              <View key={idx} style={styles.featureCard}>
                <View style={styles.featureIconBox}>
                  <Text style={styles.featureIconTxt}>{feat.icon}</Text>
                </View>
                <View style={styles.featureTextBox}>
                  <Text style={styles.featureMainTxt}>{feat.title}</Text>
                  <Text style={styles.featureSubTxt}>{feat.desc}</Text>
                </View>
              </View>
            ))}
          </View>

        </Animated.View>
      </ScrollView>

      {/* BOTTOM CONTROLS & ACTIONS */}
      <View style={styles.bottomSection}>
        {/* 3 Pagination Dots */}
        <View style={styles.dotsRow}>
          {[0, 1, 2].map(idx => (
            <TouchableOpacity key={idx} onPress={() => goTo(idx)} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
              <View style={[styles.dot, pageIdx === idx ? styles.dotActive : styles.dotInactive]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Buttons */}
        <View style={styles.actionRow}>
          {pageIdx < 2 ? (
            <TouchableOpacity onPress={nextSlide} activeOpacity={0.88} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnTxt}>Next</Text>
              <Ionicons name="chevron-forward" size={17} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: '100%', gap: 8 }}>
              <TouchableOpacity
                onPress={() => { haptic(); router.push('/(auth)/signup' as any); }}
                activeOpacity={0.88}
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryBtnTxt}>Get Started Free</Text>
                <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => { haptic(); router.push('/(auth)/login' as any); }}
                activeOpacity={0.7}
                style={styles.secondaryBtn}
              >
                <Text style={styles.secondaryBtnTxt}>Already have an account? Sign In</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // SOLID UNIFIED BACKGROUND (NO DIS-DIS, SEAMLESS WITH IMAGES)
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },

  // TOP NAVIGATION
  topNav: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 38,
    zIndex: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPlaceholder: {
    width: 36,
    height: 36,
  },
  skipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  skipTxt: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#64748B',
  },

  // SCROLL CONTENT
  scrollArea: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
    paddingVertical: 6,
  },
  mainSection: {
    width: '100%',
    alignItems: 'center',
  },

  // MASCOT & CRISP BACKDROP (ZERO BLUR FILTER)
  mascotSection: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 10,
  },
  crispBackdropShape: {
    position: 'absolute',
    width: Math.min(SW * 0.58, 220),
    height: Math.min(SW * 0.58, 220),
    borderRadius: Math.min(SW * 0.58, 220) / 2,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    zIndex: 1,
  },
  crispGroundOval: {
    position: 'absolute',
    bottom: -2,
    width: 120,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E2E8F0',
    zIndex: 1,
  },
  mascotWrap: {
    width: Math.min(SW * 0.62, 230),
    height: Math.min(SH * 0.28, 230),
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 2,
  },
  mascotImg: {
    width: '100%',
    height: '100%',
  },

  // HEADINGS
  textSection: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginBottom: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18.5,
    maxWidth: 320,
  },

  // NEAT STRUCTURED FEATURES LIST ("FEATURES KE TSARI")
  featuresList: {
    width: '100%',
    gap: 8,
    marginBottom: 10,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 13,
    paddingVertical: 9,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  featureIconBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  featureIconTxt: {
    fontSize: 15,
  },
  featureTextBox: {
    flex: 1,
  },
  featureMainTxt: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 1,
  },
  featureSubTxt: {
    fontSize: 10.5,
    fontWeight: '500',
    color: '#64748B',
    lineHeight: 14,
  },

  // BOTTOM SECTION
  bottomSection: {
    width: '100%',
    alignItems: 'center',
    gap: 14,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  dot: {
    height: 7,
    borderRadius: 3.5,
  },
  dotActive: {
    width: 20,
    backgroundColor: '#0F172A',
  },
  dotInactive: {
    width: 7,
    backgroundColor: '#CBD5E1',
  },

  // BUTTONS
  actionRow: {
    width: '100%',
  },
  primaryBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  primaryBtnTxt: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
  },
  secondaryBtnTxt: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748B',
  },
});
