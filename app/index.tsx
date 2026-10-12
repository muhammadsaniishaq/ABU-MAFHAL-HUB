import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Platform,
  StatusBar,
  ActivityIndicator,
  Linking,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
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
  withDelay,
  Easing,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { supabase, processOAuthReturn } from '../services/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SW, height: SH } = Dimensions.get('window');

const COPY = {
  support: '24/7 Support',
  brand: 'ABU MAFHAL SUB',
  tagline: 'Smart Telecom & Automated Financial Services',
  slide1Badge: 'OFFICIAL PLATFORM',
  slide1Title: 'Fast, Reliable &\nAutomated Telecom',
  slide1Sub: 'Buy cheap data bundles, airtime, and pay utility bills at wholesale prices with instant automated delivery.',
  pillar1Title: 'Instant 5G Data',
  pillar1Sub: 'MTN, Airtel, Glo & 9mobile in seconds',
  pillar2Title: 'Dedicated Bank Accounts',
  pillar2Sub: 'Personal Moniepoint & Wema instant wallet',
  pillar3Title: 'Bills & Electricity',
  pillar3Sub: 'Prepaid tokens & TV renewals instantly',
  statProcessed: '₦2.5B+',
  statProcessedLbl: 'Processed',
  statUsers: '50,000+',
  statUsersLbl: 'Active Users',
  statUptime: '99.98%',
  statUptimeLbl: 'Uptime',
  slide2Badge: 'OUR SERVICES',
  slide2Title: 'Everything You Need\nIn One App',
  slide2Sub: 'Wholesale telecom rates for personal use and profitable reselling.',
  srv1Title: 'Cheap Data',
  srv1Desc: 'SME, Corporate packages from ₦240/GB',
  srv2Title: 'Airtime Recharge',
  srv2Desc: 'Instant top-up with up to 3% cashback',
  srv3Title: 'Electricity & TV',
  srv3Desc: 'AEDC, EKEDC tokens & DStv/GOtv instantly',
  srv4Title: 'Virtual Accounts',
  srv4Desc: 'Auto 0-fee accounts that fund wallet instantly',
  partnersLabel: 'SUPPORTED NETWORKS & BANKS',
  slide3Badge: 'START IN 30 SECONDS',
  slide3Title: 'Ready to Experience\nSeamless Telecom?',
  slide3Sub: 'Join over 50,000 happy users and start saving today.',
  step1Num: '01', step1Title: 'Create Free Account', step1Desc: 'Sign up with your phone & email.',
  step2Num: '02', step2Title: 'Fund Your Wallet', step2Desc: 'Instant bank transfer to your account.',
  step3Num: '03', step3Title: 'Transact & Profit', step3Desc: 'Buy wholesale or resell for income.',
  btnSignup: 'Create Free Account',
  btnSignupSub: 'Zero fees · Instant access',
  btnSignin: 'Sign In to Account',
  securityBadge: 'Bank-Grade 256-Bit SSL · NDPA Certified',
  skip: 'Skip', next: 'Next', back: 'Back', verifying: 'Checking session...',
};

// ─── FLOATING PARTICLE ────────────────────────────────────────────────────────
function FloatingParticle({ x, y, size, delay, color }: { x: number; y: number; size: number; delay: number; color: string }) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(0.7, { duration: 1200 }),
        withTiming(0.15, { duration: 1200 }),
      ), -1, true
    ));
    translateY.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(-18, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      ), -1, true
    ));
    scale.value = withDelay(delay, withSpring(1, { damping: 10, stiffness: 80 }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[{
        position: 'absolute',
        left: x,
        top: y,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
      }, animStyle]}
    />
  );
}

// ─── ORBIT RING ───────────────────────────────────────────────────────────────
function OrbitRing({ radius, duration, color = 'rgba(212, 175, 55, 0.25)', reverse = false }: {
  radius: number; duration: number; color?: string; reverse?: boolean;
}) {
  const rotate = useSharedValue(0);
  useEffect(() => {
    rotate.value = withRepeat(
      withTiming(reverse ? -360 : 360, { duration, easing: Easing.linear }),
      -1,
      false
    );
  }, [reverse, duration]);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value}deg` }],
  }));
  return (
    <Animated.View
      style={[{
        position: 'absolute',
        width: radius * 2,
        height: radius * 2,
        borderRadius: radius,
        borderWidth: 1.5,
        borderColor: color,
        borderStyle: 'dashed',
        alignSelf: 'center',
      }, animStyle]}
    />
  );
}

// ─── DOT INDICATOR ────────────────────────────────────────────────────────────
function DotIndicator({ active, color = '#D97706' }: { active: boolean; color?: string }) {
  const widthAnim = useSharedValue(active ? 28 : 8);
  const opacityAnim = useSharedValue(active ? 1 : 0.3);
  useEffect(() => {
    widthAnim.value = withSpring(active ? 28 : 8, { damping: 15, stiffness: 130 });
    opacityAnim.value = withTiming(active ? 1 : 0.3, { duration: 250 });
  }, [active]);
  const animStyle = useAnimatedStyle(() => ({ width: widthAnim.value, opacity: opacityAnim.value }));
  return (
    <Animated.View style={[styles.dot, { backgroundColor: active ? color : '#CBD5E1' }, animStyle]} />
  );
}

// ─── SLIDE THEMES ─────────────────────────────────────────────────────────────
const SLIDE_THEMES = [
  {
    key: 'telecom',
    accent: '#D97706',
    accentGrad: ['#F59E0B', '#D97706', '#B45309'] as const,
    glowColor: '#FEF3C7',
    glowShadow: '#D97706',
    pillText: '✦ OFFICIAL 5G PLATFORM',
    pillBg: 'rgba(254, 243, 199, 0.95)',
    pillBorder: '#FDE68A',
    pillTxtColor: '#B45309',
    badgeLeft: '⚡ 5G Automated',
    badgeRight: '₦240 / GB SME',
    bgColors: ['#FFFDF5', '#FEF8E7', '#F0F9FF'] as const,
    orbTop: '#FEF3C7',
    orbBottom: '#DBEAFE',
  },
  {
    key: 'banking',
    accent: '#2563EB',
    accentGrad: ['#3B82F6', '#2563EB', '#1D4ED8'] as const,
    glowColor: '#DBEAFE',
    glowShadow: '#2563EB',
    pillText: '✦ DEDICATED AUTO WALLET',
    pillBg: 'rgba(239, 246, 255, 0.95)',
    pillBorder: '#BFDBFE',
    pillTxtColor: '#1D4ED8',
    badgeLeft: '🏦 Moniepoint / Wema',
    badgeRight: '0-Fee Deposit',
    bgColors: ['#F8FAFC', '#EFF6FF', '#F5F3FF'] as const,
    orbTop: '#DBEAFE',
    orbBottom: '#EDE9FE',
  },
  {
    key: 'start',
    accent: '#059669',
    accentGrad: ['#10B981', '#059669', '#047857'] as const,
    glowColor: '#D1FAE5',
    glowShadow: '#059669',
    pillText: '✦ 30-SECOND ONBOARDING',
    pillBg: 'rgba(236, 253, 245, 0.95)',
    pillBorder: '#A7F3D0',
    pillTxtColor: '#047857',
    badgeLeft: '🚀 Instant Access',
    badgeRight: '🔒 256-Bit SSL',
    bgColors: ['#F0FDF4', '#DCFCE7', '#FEF9C3'] as const,
    orbTop: '#DCFCE7',
    orbBottom: '#FEF9C3',
  },
];

// ─── SLIDE CONTENT ANIMATED WRAPPER ──────────────────────────────────────────
function SlideWrapper({ children, visible }: { children: React.ReactNode; visible: boolean }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    if (visible) {
      opacity.value = 0;
      translateY.value = 20;
      opacity.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
      translateY.value = withSpring(0, { damping: 18, stiffness: 120 });
    }
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) return null;

  return <Animated.View style={[{ width: '100%' }, animStyle]}>{children}</Animated.View>;
}

// ─── HERO MASCOT SECTION WITH RICH ADO & DECORATIONS ─────────────────────────
function MascotHero({ pageIdx }: { pageIdx: number }) {
  const currentTheme = SLIDE_THEMES[pageIdx] || SLIDE_THEMES[0];
  const float = useSharedValue(0);
  const scaleIn = useSharedValue(0.7);
  const glowPulse = useSharedValue(1);
  const switchFade = useSharedValue(1);
  const switchScale = useSharedValue(1);

  useEffect(() => {
    scaleIn.value = withSpring(1, { damping: 14, stiffness: 90 });
    float.value = withRepeat(
      withSequence(
        withTiming(-14, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
      ), -1, true
    );
    glowPulse.value = withRepeat(
      withSequence(
        withTiming(1.22, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
      ), -1, true
    );
  }, []);

  useEffect(() => {
    switchFade.value = 0.2;
    switchScale.value = 0.88;
    switchFade.value = withTiming(1, { duration: 340, easing: Easing.out(Easing.cubic) });
    switchScale.value = withSpring(1, { damping: 13, stiffness: 130 });
  }, [pageIdx]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: float.value },
      { scale: scaleIn.value * switchScale.value },
    ],
    opacity: switchFade.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowPulse.value }],
    opacity: interpolate(glowPulse.value, [1, 1.22], [0.65, 0.2]),
  }));

  const groundShadowStyle = useAnimatedStyle(() => ({
    transform: [
      { scaleX: interpolate(float.value, [-14, 0], [1.25, 0.90]) },
      { scaleY: interpolate(float.value, [-14, 0], [0.75, 1.10]) },
    ],
    opacity: interpolate(float.value, [-14, 0], [0.12, 0.38]),
  }));

  const mascotImages = [
    require('../assets/images/splash_hero_character.gif'),
    require('../assets/images/splash_hero_character2.gif'),
    require('../assets/images/splash_hero_character3.gif'),
  ];

  return (
    <View style={styles.mascotHeroContainer}>
      {/* Frosted Glass Podium Spotlight Frame */}
      <View style={styles.mascotStageCard}>
        <LinearGradient
          colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.30)', 'rgba(255,255,255,0.12)']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={[styles.stageInnerGlow, { borderColor: currentTheme.accent + '25' }]} />
      </View>

      {/* Dynamic Themed Triple Orbit Cosmic Rings */}
      <View style={styles.orbitCenter}>
        <OrbitRing radius={100} duration={8000} color={currentTheme.accent + '38'} />
        <OrbitRing radius={135} duration={13000} color={currentTheme.accent + '25'} reverse />
        <OrbitRing radius={165} duration={19000} color={currentTheme.accent + '15'} />
      </View>

      {/* Luminous Neon Aura Glow Behind Mascot */}
      <Animated.View
        style={[
          styles.mascotGlow,
          {
            backgroundColor: currentTheme.glowColor,
            shadowColor: currentTheme.glowShadow,
          },
          glowStyle,
        ]}
      />

      {/* 3D Dynamic Floating Ground Shadow */}
      <Animated.View style={[styles.groundShadow, groundShadowStyle]} />

      {/* Floating Holographic Main Pill Badge */}
      <Animated.View
        style={[
          styles.mascotPillBadge,
          {
            backgroundColor: currentTheme.pillBg,
            borderColor: currentTheme.pillBorder,
          },
        ]}
      >
        <Text style={[styles.mascotPillBadgeTxt, { color: currentTheme.pillTxtColor }]}>
          {currentTheme.pillText}
        </Text>
      </Animated.View>

      {/* Side Micro-Tags for Cutting-Edge Modern Look */}
      <View style={[styles.sideTagLeft, { borderColor: currentTheme.accent + '35' }]}>
        <Text style={[styles.sideTagTxt, { color: currentTheme.accent }]}>{currentTheme.badgeLeft}</Text>
      </View>
      <View style={[styles.sideTagRight, { borderColor: currentTheme.accent + '35' }]}>
        <Text style={[styles.sideTagTxt, { color: currentTheme.accent }]}>{currentTheme.badgeRight}</Text>
      </View>

      {/* Centerpiece Hero Mascot Cartoon GIF Animation */}
      <Animated.View style={[styles.mascotImageWrap, floatStyle]}>
        <Image
          key={`mascot-gif-${pageIdx}`}
          source={mascotImages[pageIdx] || mascotImages[0]}
          style={styles.mascotImage}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Ambient Celestial Particles */}
      <FloatingParticle x={14} y={20} size={11} delay={0} color="rgba(212,175,55,0.85)" />
      <FloatingParticle x={SW * 0.78} y={10} size={9} delay={200} color={currentTheme.accent + '99'} />
      <FloatingParticle x={10} y={85} size={7} delay={450} color="rgba(16,185,129,0.70)" />
      <FloatingParticle x={SW * 0.74} y={100} size={10} delay={700} color="rgba(212,175,55,0.70)" />
      <FloatingParticle x={38} y={130} size={6} delay={300} color="rgba(244,63,94,0.55)" />
      <FloatingParticle x={SW * 0.52} y={6} size={7} delay={600} color={currentTheme.accent + '85'} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SPLASH SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function SplashScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [checking, setChecking] = useState(true);
  const [pageIdx, setPageIdx] = useState(0);
  const [storyProgress, setStoryProgress] = useState(0);
  const isPaused = useRef(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  // Header animation
  const headerOpacity = useSharedValue(0);
  const headerY = useSharedValue(-20);
  // Bottom bar animation
  const bottomOpacity = useSharedValue(0);
  const bottomY = useSharedValue(30);

  const currentTheme = SLIDE_THEMES[pageIdx] || SLIDE_THEMES[0];

  useEffect(() => {
    checkAuthSession();
    // Animate header in
    headerOpacity.value = withDelay(300, withTiming(1, { duration: 600 }));
    headerY.value = withDelay(300, withSpring(0, { damping: 16, stiffness: 100 }));
    // Animate bottom bar in
    bottomOpacity.value = withDelay(500, withTiming(1, { duration: 600 }));
    bottomY.value = withDelay(500, withSpring(0, { damping: 16, stiffness: 100 }));
  }, []);

  // ─── AUTO-ADVANCE STORY PROGRESS BAR ───────────────────────────────────────
  useEffect(() => {
    setStoryProgress(0);
    const interval = setInterval(() => {
      if (isPaused.current) return;
      setStoryProgress(prev => {
        if (prev >= 100) {
          setPageIdx(curr => {
            if (curr < 2) return curr + 1;
            return curr;
          });
          return 0;
        }
        return prev + 2; // fills in ~5 seconds
      });
    }, 100);

    return () => clearInterval(interval);
  }, [pageIdx]);

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
        // If testing/previewing splash with URL parameter ?preview=true or ?splash=true, stay on splash:
        const isPreview = Platform.OS === 'web' && typeof window !== 'undefined' && (
          window.location.search.includes('preview') || window.location.search.includes('splash')
        );
        if (!isPreview) {
          setTimeout(() => router.replace('/dashboard' as any), 600);
        } else {
          setChecking(false);
        }
      } else {
        await AsyncStorage.removeItem('has_active_session');
        await AsyncStorage.removeItem('app_unlocked');
        setChecking(false);
      }
    } catch {
      setChecking(false);
    }
  };

  const haptic = useCallback(() => {
    if (Platform.OS !== 'web') {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    }
  }, []);

  const goToPage = (idx: number) => {
    haptic();
    setStoryProgress(0);
    setPageIdx(idx);
  };
  const goNext = () => {
    haptic();
    setStoryProgress(0);
    setPageIdx(p => Math.min(p + 1, 2));
  };
  const goPrev = () => {
    haptic();
    setStoryProgress(0);
    setPageIdx(p => Math.max(p - 1, 0));
  };
  const goSkip = () => {
    haptic();
    setStoryProgress(100);
    setPageIdx(2);
  };

  const handleTouchStart = (e: any) => {
    isPaused.current = true;
    touchStartX.current = e.nativeEvent.pageX;
    touchStartY.current = e.nativeEvent.pageY;
  };
  const handleTouchEnd = (e: any) => {
    isPaused.current = false;
    const dx = e.nativeEvent.pageX - touchStartX.current;
    const dy = e.nativeEvent.pageY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      dx < 0 ? goNext() : goPrev();
    }
  };

  const c = COPY;
  const navBarBottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 16) + 10;

  const headerAnimStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: headerY.value }],
  }));
  const bottomAnimStyle = useAnimatedStyle(() => ({
    opacity: bottomOpacity.value,
    transform: [{ translateY: bottomY.value }],
  }));

  return (
    <View style={styles.screenContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Dynamic Themed Background Gradient */}
      <LinearGradient
        colors={currentTheme.bgColors}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Themed ambient decorative orbs */}
      <View style={[styles.bgOrbTopRight, { backgroundColor: currentTheme.orbTop }]} />
      <View style={[styles.bgOrbBottomLeft, { backgroundColor: currentTheme.orbBottom }]} />
      <View style={styles.bgOrbCenter} />

      <View
        style={[styles.mainContainer, { paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 44 : 28) }]}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* TOP HEADER */}
        <Animated.View style={[styles.topHeaderBar, headerAnimStyle]}>
          {/* Live System Automation Status Badge */}
          <View style={styles.systemStatusPill}>
            <View style={styles.systemLiveDot} />
            <Text style={styles.systemStatusTxt}>Automated 24/7</Text>
          </View>

          {/* Brand Mark with Golden Radiance */}
          <View style={styles.brandMark}>
            <Image
              source={require('../assets/images/logo.png')}
              style={styles.brandMarkLogo}
              resizeMode="contain"
            />
          </View>

          <TouchableOpacity
            onPress={() => Linking.openURL('https://wa.me/2348144445438?text=Hello%20Abu%20Mafhal%20Support')}
            style={styles.supportPillBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-whatsapp" size={14} color="#16A34A" style={{ marginRight: 5 }} />
            <Text style={styles.supportPillTxt}>{c.support}</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* TOP STORY STATUS PROGRESS BARS */}
        <View style={styles.storyBarsContainer}>
          {[0, 1, 2].map((idx) => {
            const isPast = pageIdx > idx;
            const isCurrent = pageIdx === idx;
            return (
              <TouchableOpacity
                key={`story-bar-${idx}`}
                onPress={() => goToPage(idx)}
                style={styles.storyBarTrack}
                activeOpacity={0.85}
              >
                <View
                  style={[
                    styles.storyBarFill,
                    {
                      backgroundColor: currentTheme.accent,
                      width: isPast ? '100%' : isCurrent ? `${storyProgress}%` : '0%',
                    },
                  ]}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* MASCOT HERO WITH CARTOON GIF & DECORATIONS */}
        <MascotHero pageIdx={pageIdx} />

        {/* SLIDE CONTENT AREA (SCROLL-PROTECTED FOR ALL MOBILE SCREENS) */}
        <ScrollView
          style={styles.contentAreaScroll}
          contentContainerStyle={styles.contentArea}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <SlideWrapper visible={pageIdx === 0}>
            <SlideWelcome c={c} />
          </SlideWrapper>
          <SlideWrapper visible={pageIdx === 1}>
            <SlideServices c={c} />
          </SlideWrapper>
          <SlideWrapper visible={pageIdx === 2}>
            <SlideGetStarted c={c} checking={checking} router={router} haptic={haptic} />
          </SlideWrapper>
        </ScrollView>

        {/* BOTTOM NAV BAR */}
        <Animated.View style={[styles.bottomNavBar, { paddingBottom: navBarBottomPadding }, bottomAnimStyle]}>
          {/* Glass shimmer line */}
          <View style={styles.navTopShimmer} />

          {/* Interactive Navigation Dots */}
          <View style={styles.dotsContainer}>
            {[0, 1, 2].map(i => (
              <TouchableOpacity
                key={i}
                onPress={() => goToPage(i)}
                hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
              >
                <DotIndicator active={pageIdx === i} color={currentTheme.accent} />
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.navControlsRow}>
            {pageIdx < 2 ? (
              <>
                <TouchableOpacity onPress={goSkip} style={styles.skipBtn} activeOpacity={0.7}>
                  <Text style={styles.skipBtnTxt}>{c.skip}</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={goNext} activeOpacity={0.88} style={styles.nextBtnWrap}>
                  <LinearGradient
                    colors={currentTheme.accentGrad}
                    style={styles.nextBtn}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.nextBtnTxt}>{c.next}</Text>
                    <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
                  </LinearGradient>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity onPress={() => goToPage(0)} style={styles.backBtn} activeOpacity={0.75}>
                <Ionicons name="arrow-back" size={15} color="#64748B" style={{ marginRight: 6 }} />
                <Text style={styles.backBtnTxt}>{c.back}</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

// ─── SLIDE 1: WELCOME ─────────────────────────────────────────────────────────
function SlideWelcome({ c }: { c: typeof COPY }) {
  return (
    <View style={styles.slideContainer}>
      <View style={styles.centerTextWrap}>
        <View style={styles.badgePill}>
          <Ionicons name="sparkles" size={11} color="#D97706" style={{ marginRight: 4 }} />
          <Text style={styles.badgePillTxt}>{c.slide1Badge}</Text>
        </View>
        <Text style={styles.mainTitle}>{c.slide1Title}</Text>
        <Text style={styles.mainSubtitle}>{c.slide1Sub}</Text>
      </View>

      <View style={styles.pillarsContainer}>
        {[
          { icon: 'wifi', color: '#2563EB', bg: '#EFF6FF', title: c.pillar1Title, sub: c.pillar1Sub, accent: '#F59E0B' },
          { icon: 'wallet-outline', color: '#DB2777', bg: '#FDF2F8', title: c.pillar2Title, sub: c.pillar2Sub, accent: '#DB2777' },
          { icon: 'flash-outline', color: '#059669', bg: '#ECFDF5', title: c.pillar3Title, sub: c.pillar3Sub, accent: '#059669' },
        ].map((p, i) => (
          <View key={i} style={[styles.pillarCard, { borderLeftWidth: 3.5, borderLeftColor: p.accent }]}>
            <View style={[styles.pillarIconWrap, { backgroundColor: p.bg }]}>
              <Ionicons name={p.icon as any} size={18} color={p.color} />
            </View>
            <View style={styles.pillarTextWrap}>
              <Text style={styles.pillarTitle}>{p.title}</Text>
              <Text style={styles.pillarDesc}>{p.sub}</Text>
            </View>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" style={{ opacity: 0.85 }} />
          </View>
        ))}
      </View>

      <View style={styles.statsRibbon}>
        {[
          { val: c.statProcessed, lbl: c.statProcessedLbl },
          null,
          { val: c.statUsers, lbl: c.statUsersLbl },
          null,
          { val: c.statUptime, lbl: c.statUptimeLbl },
        ].map((item, i) =>
          item === null ? (
            <View key={i} style={styles.statDivider} />
          ) : (
            <View key={i} style={styles.statItem}>
              <Text style={styles.statVal}>{item.val}</Text>
              <Text style={styles.statLbl}>{item.lbl}</Text>
            </View>
          )
        )}
      </View>
    </View>
  );
}

// ─── SLIDE 2: SERVICES ────────────────────────────────────────────────────────
function SlideServices({ c }: { c: typeof COPY }) {
  return (
    <View style={styles.slideContainer}>
      <View style={styles.centerTextWrap}>
        <View style={[styles.badgePill, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
          <Ionicons name="grid-outline" size={11} color="#2563EB" style={{ marginRight: 4 }} />
          <Text style={[styles.badgePillTxt, { color: '#2563EB' }]}>{c.slide2Badge}</Text>
        </View>
        <Text style={styles.mainTitle}>{c.slide2Title}</Text>
        <Text style={styles.mainSubtitle}>{c.slide2Sub}</Text>
      </View>

      <View style={styles.servicesGrid}>
        {[
          { icon: 'phone-portrait-outline', color: '#D97706', bg: '#FEF3C7', title: c.srv1Title, desc: c.srv1Desc },
          { icon: 'call-outline', color: '#2563EB', bg: '#EFF6FF', title: c.srv2Title, desc: c.srv2Desc },
          { icon: 'flash-outline', color: '#059669', bg: '#ECFDF5', title: c.srv3Title, desc: c.srv3Desc },
          { icon: 'card-outline', color: '#9333EA', bg: '#F3E8FF', title: c.srv4Title, desc: c.srv4Desc },
        ].map((svc, i) => (
          <View key={i} style={styles.serviceGridCard}>
            <View style={[styles.serviceIconCircle, { backgroundColor: svc.bg }]}>
              <Ionicons name={svc.icon as any} size={18} color={svc.color} />
            </View>
            <Text style={styles.serviceCardTitle}>{svc.title}</Text>
            <Text style={styles.serviceCardDesc}>{svc.desc}</Text>
          </View>
        ))}
      </View>

      <View style={styles.partnersSection}>
        <Text style={styles.partnersHeading}>{c.partnersLabel}</Text>
        <View style={styles.networkBadgesRow}>
          {[
            { lbl: 'MTN 5G', border: '#F59E0B', txt: '#B45309' },
            { lbl: 'AIRTEL', border: '#EF4444', txt: '#DC2626' },
            { lbl: 'GLO', border: '#10B981', txt: '#047857' },
            { lbl: '9MOBILE', border: '#84CC16', txt: '#4D7C0F' },
            { lbl: 'MONIEPOINT', border: '#0284C7', txt: '#0369A1' },
            { lbl: 'WEMA', border: '#F43F5E', txt: '#BE123C' },
          ].map((n, i) => (
            <View key={i} style={[styles.networkBadge, { borderColor: n.border }]}>
              <Text style={[styles.networkBadgeTxt, { color: n.txt }]}>{n.lbl}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── SLIDE 3: GET STARTED ─────────────────────────────────────────────────────
function SlideGetStarted({ c, checking, router, haptic }: {
  c: typeof COPY; checking: boolean; router: any; haptic: () => void;
}) {
  return (
    <View style={styles.slideContainer}>
      <View style={styles.centerTextWrap}>
        <View style={[styles.badgePill, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
          <Ionicons name="rocket-outline" size={11} color="#059669" style={{ marginRight: 4 }} />
          <Text style={[styles.badgePillTxt, { color: '#059669' }]}>{c.slide3Badge}</Text>
        </View>
        <Text style={styles.mainTitle}>{c.slide3Title}</Text>
        <Text style={styles.mainSubtitle}>{c.slide3Sub}</Text>
      </View>

      <View style={styles.stepsList}>
        {[
          { num: c.step1Num, title: c.step1Title, desc: c.step1Desc, bg: '#FEF3C7', border: '#FDE68A', numColor: '#B45309' },
          { num: c.step2Num, title: c.step2Title, desc: c.step2Desc, bg: '#EFF6FF', border: '#BFDBFE', numColor: '#2563EB' },
          { num: c.step3Num, title: c.step3Title, desc: c.step3Desc, bg: '#ECFDF5', border: '#A7F3D0', numColor: '#059669' },
        ].map((step, i) => (
          <View key={i} style={styles.stepCard}>
            <View style={[styles.stepNumberBadge, { backgroundColor: step.bg, borderColor: step.border }]}>
              <Text style={[styles.stepNumberTxt, { color: step.numColor }]}>{step.num}</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepDesc}>{step.desc}</Text>
            </View>
            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
          </View>
        ))}
      </View>

      <View style={styles.ctaSection}>
        {checking ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color="#D97706" />
            <Text style={styles.loadingTxt}>{c.verifying}</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <TouchableOpacity
              onPress={() => { haptic(); router.push('/(auth)/signup'); }}
              activeOpacity={0.88}
              style={styles.primaryCtaWrap}
            >
              <LinearGradient
                colors={['#F59E0B', '#D97706', '#B45309']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryCtaBtn}
              >
                <View style={styles.primaryCtaIconWrap}>
                  <Ionicons name="sparkles" size={16} color="#FFFFFF" />
                </View>
                <View style={styles.primaryCtaTextWrap}>
                  <Text style={styles.primaryCtaTitle}>{c.btnSignup}</Text>
                  <Text style={styles.primaryCtaSub}>{c.btnSignupSub}</Text>
                </View>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => { haptic(); router.push('/(auth)/login'); }}
              activeOpacity={0.8}
              style={styles.secondaryCtaBtn}
            >
              <Ionicons name="log-in-outline" size={17} color="#0F172A" style={{ marginRight: 8 }} />
              <Text style={styles.secondaryCtaTxt}>{c.btnSignin}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.securityRow}>
        <Ionicons name="shield-checkmark" size={12} color="#059669" style={{ marginRight: 5 }} />
        <Text style={styles.securityTxt}>{c.securityBadge}</Text>
      </View>
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screenContainer: { flex: 1, backgroundColor: '#FFFBF0' },
  mainContainer: { flex: 1, maxWidth: 500, alignSelf: 'center', width: '100%', justifyContent: 'space-between' },

  // BG Orbs
  bgOrbTopRight: {
    position: 'absolute', top: -80, right: -60,
    width: 280, height: 280, borderRadius: 140,
    backgroundColor: '#FEF3C7', opacity: 0.55,
  },
  bgOrbBottomLeft: {
    position: 'absolute', bottom: -60, left: -50,
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: '#DBEAFE', opacity: 0.45,
  },
  bgOrbCenter: {
    position: 'absolute', top: '35%', left: '20%',
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: '#DCFCE7', opacity: 0.25,
  },

  // TOP BAR
  topHeaderBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8, zIndex: 10,
  },
  systemStatusPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0',
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 3,
  },
  systemLiveDot: {
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: '#10B981', marginRight: 6,
  },
  systemStatusTxt: { fontSize: 11.5, fontWeight: '800', color: '#0F172A', letterSpacing: 0.3 },
  brandMark: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1.5, borderColor: '#FDE68A',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#D97706', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
    overflow: 'hidden',
  },
  brandMarkLogo: { width: 32, height: 32 },
  supportPillBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: '#DCFCE7',
    shadowColor: '#16A34A', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  supportPillTxt: { fontSize: 12, fontWeight: '700', color: '#15803D' },

  // STORY PROGRESS BARS
  storyBarsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    marginTop: 2,
    marginBottom: 4,
    width: '100%',
  },
  storyBarTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(203, 213, 225, 0.45)',
    overflow: 'hidden',
  },
  storyBarFill: {
    height: '100%',
    borderRadius: 2,
  },

  // MASCOT HERO & ADO
  mascotHeroContainer: {
    width: '100%', alignItems: 'center', justifyContent: 'center',
    height: Math.min(SH * 0.36, 290), position: 'relative', overflow: 'visible',
    marginVertical: 4,
  },
  mascotStageCard: {
    position: 'absolute',
    width: Math.min(SW * 0.92, 380),
    height: Math.min(SH * 0.33, 270),
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.95)',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.09,
    shadowRadius: 22,
    elevation: 4,
  },
  stageInnerGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    borderWidth: 1.5,
  },
  orbitCenter: {
    position: 'absolute', width: '100%', height: '100%',
    alignItems: 'center', justifyContent: 'center',
  },
  mascotGlow: {
    position: 'absolute', width: 260, height: 260, borderRadius: 130,
    backgroundColor: '#FEF3C7',
    shadowColor: '#D97706', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 50, elevation: 0,
  },
  groundShadow: {
    position: 'absolute',
    bottom: -6,
    width: 170,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.38,
    shadowRadius: 12,
    elevation: 4,
  },
  mascotPillBadge: {
    position: 'absolute',
    top: 6,
    zIndex: 15,
    paddingHorizontal: 14,
    paddingVertical: 5.5,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 4,
  },
  mascotPillBadgeTxt: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  sideTagLeft: {
    position: 'absolute',
    left: 8,
    bottom: 22,
    zIndex: 14,
    backgroundColor: 'rgba(255,255,255,0.94)',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  sideTagRight: {
    position: 'absolute',
    right: 8,
    bottom: 22,
    zIndex: 14,
    backgroundColor: 'rgba(255,255,255,0.94)',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  sideTagTxt: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  mascotImageWrap: {
    width: Math.min(SW * 0.90, 360),
    height: Math.min(SH * 0.32, 260),
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 12,
  },
  mascotImage: { width: '100%', height: '100%' },

  // CONTENT AREA
  contentAreaScroll: {
    flex: 1,
    width: '100%',
  },
  contentArea: {
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  slideContainer: { width: '100%', alignItems: 'center' },
  centerTextWrap: { alignItems: 'center', marginBottom: 14, paddingHorizontal: 8 },

  // BADGE
  badgePill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#FDE68A',
  },
  badgePillTxt: { fontSize: 10, fontWeight: '800', color: '#B45309', letterSpacing: 0.8 },
  mainTitle: {
    fontSize: 21, fontWeight: '900', color: '#0F172A',
    textAlign: 'center', lineHeight: 27, letterSpacing: -0.3, marginBottom: 6,
  },
  mainSubtitle: {
    fontSize: 12.5, fontWeight: '500', color: '#64748B',
    textAlign: 'center', lineHeight: 17.5, maxWidth: 360,
  },

  // PILLARS
  pillarsContainer: { width: '100%', gap: 8, marginBottom: 12 },
  pillarCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12,
    borderWidth: 1, borderColor: '#F1F5F9',
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  pillarIconWrap: {
    width: 36, height: 36, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', marginRight: 11,
  },
  pillarTextWrap: { flex: 1 },
  pillarTitle: { fontSize: 12.5, fontWeight: '800', color: '#0F172A', marginBottom: 1 },
  pillarDesc: { fontSize: 10.5, fontWeight: '500', color: '#64748B', lineHeight: 14 },

  // STATS
  statsRibbon: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.92)', width: '100%',
    borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14,
    borderWidth: 1, borderColor: '#E2E8F0',
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  statItem: { alignItems: 'center', flex: 1 },
  statVal: { fontSize: 14, fontWeight: '900', color: '#0F172A' },
  statLbl: { fontSize: 9.5, fontWeight: '600', color: '#64748B', marginTop: 1 },
  statDivider: { width: 1, height: 22, backgroundColor: '#E2E8F0' },

  // SERVICES GRID
  servicesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, width: '100%', marginBottom: 12 },
  serviceGridCard: {
    width: (Math.min(SW, 500) - 36 - 9) / 2,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 14, padding: 11,
    borderWidth: 1, borderColor: '#F1F5F9',
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 5, elevation: 2,
  },
  serviceIconCircle: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginBottom: 7,
  },
  serviceCardTitle: { fontSize: 12.5, fontWeight: '800', color: '#0F172A', marginBottom: 3 },
  serviceCardDesc: { fontSize: 10.5, fontWeight: '500', color: '#64748B', lineHeight: 14 },

  // PARTNERS
  partnersSection: {
    width: '100%', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 14, paddingVertical: 10, paddingHorizontal: 10,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  partnersHeading: { fontSize: 9.5, fontWeight: '800', color: '#94A3B8', letterSpacing: 1.1, marginBottom: 8 },
  networkBadgesRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  networkBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, borderWidth: 1, backgroundColor: '#F8FAFC',
  },
  networkBadgeTxt: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.3 },

  // STEPS
  stepsList: { width: '100%', gap: 7, marginBottom: 12 },
  stepCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 13, paddingVertical: 9, paddingHorizontal: 11,
    borderWidth: 1, borderColor: '#F1F5F9',
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  stepNumberBadge: {
    width: 28, height: 28, borderRadius: 9, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  stepNumberTxt: { fontSize: 11, fontWeight: '900' },
  stepContent: { flex: 1 },
  stepTitle: { fontSize: 12.5, fontWeight: '800', color: '#0F172A' },
  stepDesc: { fontSize: 10.5, fontWeight: '500', color: '#64748B', marginTop: 1 },

  // CTA
  ctaSection: { width: '100%', marginBottom: 8 },
  primaryCtaWrap: {
    borderRadius: 15, overflow: 'hidden',
    shadowColor: '#D97706', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  primaryCtaBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 13, paddingHorizontal: 16,
  },
  primaryCtaIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  primaryCtaTextWrap: { flex: 1 },
  primaryCtaTitle: { fontSize: 13.5, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.2 },
  primaryCtaSub: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  secondaryCtaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 13, paddingVertical: 11,
    borderWidth: 1.5, borderColor: '#CBD5E1',
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  secondaryCtaTxt: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  loadingBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF', paddingVertical: 14, borderRadius: 13,
    borderWidth: 1, borderColor: '#E2E8F0', gap: 8,
  },
  loadingTxt: { fontSize: 12.5, fontWeight: '700', color: '#64748B' },
  securityRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 4,
  },
  securityTxt: { fontSize: 9.5, fontWeight: '600', color: '#64748B' },

  // BOTTOM NAV
  bottomNavBar: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderTopWidth: 0,
    paddingHorizontal: 20, paddingTop: 10,
    alignItems: 'center', justifyContent: 'space-between',
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 12,
  },
  navTopShimmer: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#E2E8F0', marginBottom: 8,
  },
  dotsContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10,
  },
  dot: { height: 7, borderRadius: 3.5 },
  dotActive: { backgroundColor: '#D97706' },
  dotInactive: { backgroundColor: '#CBD5E1' },
  navControlsRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', width: '100%',
  },
  skipBtn: { paddingVertical: 8, paddingHorizontal: 12 },
  skipBtnTxt: { fontSize: 13, fontWeight: '700', color: '#64748B' },
  nextBtnWrap: {
    borderRadius: 13, overflow: 'hidden',
    shadowColor: '#D97706', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 5,
  },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 9, paddingHorizontal: 18, gap: 7,
  },
  nextBtnTxt: { fontSize: 13.5, fontWeight: '900', color: '#FFFFFF' },
  backBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12 },
  backBtnTxt: { fontSize: 13, fontWeight: '700', color: '#64748B' },
});
