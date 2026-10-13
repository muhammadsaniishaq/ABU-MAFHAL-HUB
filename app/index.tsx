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
    badge: 'OFFICIAL 5G VTU PLATFORM',
    badgeBg: '#FEF3C7',
    badgeTxt: '#B45309',
    badgeBorder: '#FDE68A',
    title: 'Instant 5G Data & Airtime',
    desc: 'Wholesale packages for MTN, Airtel, Glo & 9mobile delivered in seconds with automated recharge.',
    chipL: { icon: '⚡', txt: '5G Automated' },
    chipR: { icon: '💰', txt: '₦240/GB SME' },
    features: [
      { icon: '📶', txt: 'All 4 Networks' },
      { icon: '⚡', txt: '0s Instant' },
      { icon: '₦', txt: 'From ₦240/GB' },
    ],
    glow: 'rgba(254, 243, 199, 0.75)',
  },
  {
    image: require('../assets/images/splash_hero_character2.gif'),
    badge: 'DEDICATED AUTO WALLETS',
    badgeBg: '#EFF6FF',
    badgeTxt: '#1D4ED8',
    badgeBorder: '#BFDBFE',
    title: 'Dedicated Bank Accounts',
    desc: 'Personal Moniepoint & Wema virtual accounts for zero-fee, instant automated wallet funding.',
    chipL: { icon: '🏦', txt: 'Moniepoint / Wema' },
    chipR: { icon: '🔒', txt: '0% Deposit Fee' },
    features: [
      { icon: '🏦', txt: 'Dedicated Acc' },
      { icon: '⚡', txt: 'Auto-Credit' },
      { icon: '🛡️', txt: 'Zero Fees' },
    ],
    glow: 'rgba(219, 234, 254, 0.75)',
  },
  {
    image: require('../assets/images/splash_hero_character3.gif'),
    badge: 'SIT BACK & PROFIT',
    badgeBg: '#ECFDF5',
    badgeTxt: '#047857',
    badgeBorder: '#A7F3D0',
    title: 'Sit Back & Relax',
    desc: 'Automate your utility bills, cable TV renewals, or resell VTU services to earn daily income.',
    chipL: { icon: '💡', txt: 'Prepaid Bills' },
    chipR: { icon: '💸', txt: '3% Cashback' },
    features: [
      { icon: '💡', txt: 'Electricity Tokens' },
      { icon: '📺', txt: 'DStv / GOtv' },
      { icon: '🤝', txt: 'Reseller Hub' },
    ],
    glow: 'rgba(209, 250, 229, 0.75)',
  },
];

export default function SplashScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [pageIdx, setPageIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  // Floating mascot animation (gentle, peaceful)
  const floatY = useSharedValue(0);
  const chipFloat = useSharedValue(0);

  // Transition animations
  const slideOpacity = useSharedValue(1);
  const slideScale = useSharedValue(1);

  useEffect(() => {
    checkAuthSession();

    // Gentle float (3.4s slow loop)
    floatY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true
    );

    chipFloat.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true
    );
  }, []);

  // Slide auto-advance and progress bar
  useEffect(() => {
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          setPageIdx(curr => (curr < 2 ? curr + 1 : curr));
          return 0;
        }
        return prev + 2;
      });
    }, 90);

    return () => clearInterval(interval);
  }, [pageIdx]);

  useEffect(() => {
    slideOpacity.value = 0.35;
    slideScale.value = 0.95;
    slideOpacity.value = withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) });
    slideScale.value = withSpring(1, { damping: 16, stiffness: 120 });
  }, [pageIdx]);

  const floatAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  const chipAnimStyleL = useAnimatedStyle(() => ({
    transform: [{ translateY: chipFloat.value }],
  }));

  const chipAnimStyleR = useAnimatedStyle(() => ({
    transform: [{ translateY: -chipFloat.value }],
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
          paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 44 : 24) + 8,
          paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 34 : 20) + 12,
        },
      ]}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* BACKGROUND CONCENTRIC RADAR ARCS */}
      <View style={styles.radarContainer}>
        <View style={[styles.radarCircle, styles.rc1]} />
        <View style={[styles.radarCircle, styles.rc2]} />
        <View style={[styles.radarCircle, styles.rc3]} />
      </View>

      {/* TOP HEADER: STORY BARS + NAVIGATION BAR */}
      <View style={styles.topArea}>
        <View style={styles.storyProgressRow}>
          {[0, 1, 2].map(idx => (
            <TouchableOpacity key={idx} onPress={() => goTo(idx)} style={styles.storyTrack}>
              <View
                style={[
                  styles.storyFill,
                  {
                    width: pageIdx > idx ? '100%' : pageIdx === idx ? `${progress}%` : '0%',
                  },
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.topNav}>
          {pageIdx > 0 ? (
            <TouchableOpacity onPress={prevSlide} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="chevron-back" size={20} color="#0F172A" />
            </TouchableOpacity>
          ) : (
            <View style={styles.backPlaceholder} />
          )}

          <View style={styles.brandBadge}>
            <View style={styles.brandLiveDot} />
            <Text style={styles.brandBadgeTxt}>ABU MAFHAL SUB</Text>
          </View>

          {pageIdx < 2 ? (
            <TouchableOpacity onPress={skipAll} style={styles.skipBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.skipTxt}>Skip</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.backPlaceholder} />
          )}
        </View>
      </View>

      {/* CENTERPIECE: STAGE WITH FLOATING CHIPS & CHARACTER */}
      <Animated.View style={[styles.centerStage, slideAnimStyle]}>
        
        {/* Soft Radiance Glow Backdrop */}
        <View style={[styles.mascotGlow, { backgroundColor: currentSlide.glow }]} />

        {/* Floating Feature Chip Left */}
        <Animated.View style={[styles.floatingChip, styles.chipLeft, chipAnimStyleL]}>
          <Text style={styles.chipEmoji}>{currentSlide.chipL.icon}</Text>
          <Text style={styles.chipTxt}>{currentSlide.chipL.txt}</Text>
        </Animated.View>

        {/* Floating Feature Chip Right */}
        <Animated.View style={[styles.floatingChip, styles.chipRight, chipAnimStyleR]}>
          <Text style={styles.chipEmoji}>{currentSlide.chipR.icon}</Text>
          <Text style={styles.chipTxt}>{currentSlide.chipR.txt}</Text>
        </Animated.View>

        {/* Mascot Center Illustration */}
        <Animated.View style={[styles.mascotWrap, floatAnimStyle]}>
          <View style={styles.groundShadow} />
          <Image
            key={`slide-img-${pageIdx}`}
            source={currentSlide.image}
            style={styles.mascotImg}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Rich Content: Badge, Heading, Subtitle & Features */}
        <View style={styles.contentWrap}>
          <View
            style={[
              styles.categoryBadge,
              {
                backgroundColor: currentSlide.badgeBg,
                borderColor: currentSlide.badgeBorder,
              },
            ]}
          >
            <Text style={[styles.categoryBadgeTxt, { color: currentSlide.badgeTxt }]}>
              ✦ {currentSlide.badge}
            </Text>
          </View>

          <Text style={styles.title}>{currentSlide.title}</Text>
          <Text style={styles.desc}>{currentSlide.desc}</Text>

          {/* Features Pills Row */}
          <View style={styles.featuresRow}>
            {currentSlide.features.map((feat, idx) => (
              <View key={idx} style={styles.featPill}>
                <Text style={styles.featIcon}>{feat.icon}</Text>
                <Text style={styles.featTxt}>{feat.txt}</Text>
              </View>
            ))}
          </View>
        </View>

      </Animated.View>

      {/* BOTTOM SECTION: DOTS & ACTION BUTTONS */}
      <View style={styles.bottomArea}>
        <View style={styles.dotsRow}>
          {[0, 1, 2].map(idx => (
            <TouchableOpacity key={idx} onPress={() => goTo(idx)} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
              <View style={[styles.dot, pageIdx === idx ? styles.dotActive : styles.dotInactive]} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.actionWrap}>
          {pageIdx < 2 ? (
            <TouchableOpacity onPress={nextSlide} activeOpacity={0.88} style={styles.btnPrimary}>
              <Text style={styles.btnPrimaryTxt}>Next</Text>
              <Ionicons name="chevron-forward" size={17} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: '100%', gap: 8 }}>
              <TouchableOpacity
                onPress={() => { haptic(); router.push('/(auth)/signup' as any); }}
                activeOpacity={0.88}
                style={styles.btnPrimary}
              >
                <Text style={styles.btnPrimaryTxt}>Get Started Free</Text>
                <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => { haptic(); router.push('/(auth)/login' as any); }}
                activeOpacity={0.7}
                style={styles.btnSecondary}
              >
                <Text style={styles.btnSecondaryTxt}>Already have an account? Sign In</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 22,
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },

  // RADAR CONCENTRIC CIRCLES (CLEAN LUXURY VECTOR LINES)
  radarContainer: {
    position: 'absolute',
    top: '15%',
    alignSelf: 'center',
    width: 320,
    height: 320,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    zIndex: 1,
  },
  radarCircle: {
    position: 'absolute',
    borderRadius: 999,
  },
  rc1: {
    width: 170,
    height: 170,
    borderWidth: 1,
    borderColor: 'rgba(203, 213, 225, 0.45)',
    borderStyle: 'dashed',
  },
  rc2: {
    width: 240,
    height: 240,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.4)',
  },
  rc3: {
    width: 310,
    height: 310,
    borderWidth: 1,
    borderColor: 'rgba(203, 213, 225, 0.3)',
    borderStyle: 'dashed',
  },

  // TOP AREA
  topArea: {
    width: '100%',
    gap: 12,
    zIndex: 20,
  },
  storyProgressRow: {
    flexDirection: 'row',
    gap: 6,
    width: '100%',
  },
  storyTrack: {
    flex: 1,
    height: 3.5,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  storyFill: {
    height: '100%',
    backgroundColor: '#0F172A',
    borderRadius: 2,
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 38,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  backPlaceholder: {
    width: 36,
    height: 36,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 2,
  },
  brandLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  brandBadgeTxt: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.3,
  },
  skipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  skipTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },

  // CENTER STAGE
  centerStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    position: 'relative',
    zIndex: 10,
  },
  mascotGlow: {
    position: 'absolute',
    top: '18%',
    width: 200,
    height: 200,
    borderRadius: 100,
    opacity: 0.85,
    zIndex: 1,
  },
  floatingChip: {
    position: 'absolute',
    zIndex: 15,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 5,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  chipLeft: {
    left: 4,
    top: '16%',
  },
  chipRight: {
    right: 4,
    bottom: '22%',
  },
  chipEmoji: {
    fontSize: 11,
  },
  chipTxt: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F172A',
  },
  mascotWrap: {
    width: Math.min(SW * 0.70, 260),
    height: Math.min(SH * 0.32, 260),
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 16,
    zIndex: 5,
  },
  groundShadow: {
    position: 'absolute',
    bottom: 2,
    width: 140,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
  },
  mascotImg: {
    width: '100%',
    height: '100%',
  },

  // CONTENT
  contentWrap: {
    alignItems: 'center',
    paddingHorizontal: 12,
    maxWidth: 340,
    zIndex: 10,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  categoryBadgeTxt: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  desc: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18.5,
    marginBottom: 12,
  },

  // FEATURES ROW
  featuresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  featPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  featIcon: {
    fontSize: 11,
  },
  featTxt: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#334155',
  },

  // BOTTOM
  bottomArea: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
    zIndex: 20,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  dot: {
    height: 7,
    borderRadius: 3.5,
  },
  dotActive: {
    width: 22,
    backgroundColor: '#0F172A',
  },
  dotInactive: {
    width: 7,
    backgroundColor: '#CBD5E1',
  },

  // BUTTONS
  actionWrap: {
    width: '100%',
  },
  btnPrimary: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 3,
  },
  btnPrimaryTxt: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  btnSecondary: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  btnSecondaryTxt: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748B',
  },
});
