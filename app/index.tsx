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
  Easing,
} from 'react-native-reanimated';
import { supabase, processOAuthReturn } from '../services/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SW, height: SH } = Dimensions.get('window');

type SplashTheme = 'dark' | 'light';

export default function SplashScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // 0: Global Fintech Gateway (Globe), 1: All-in-One Powerhouse (3D Phone Hub), 2: Institutional Value & Get Started
  const [pageIdx, setPageIdx] = useState(0);
  const [slideDirection, setSlideDirection] = useState<'forward' | 'backward'>('forward');
  const [theme, setTheme] = useState<SplashTheme>('dark');
  const [customSlideImages, setCustomSlideImages] = useState<(string | null)[]>([null, null, null]);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  // Reanimated motions for fluid luxury transitions
  const floatY = useSharedValue(0);
  const scaleAnim = useSharedValue(1);
  const slideOpacity = useSharedValue(1);
  const slideTranslateX = useSharedValue(0);

  useEffect(() => {
    // Continuous 60fps luxury levitation cycle
    floatY.value = withRepeat(
      withSequence(
        withTiming(-9, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2500, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    loadSavedTheme();
    checkAuthSession();
    loadCustomSplashImages();
  }, []);

  // Slide transition animation on pageIdx change (100% manual, no auto-slide!)
  useEffect(() => {
    const initialOffset = slideDirection === 'forward' ? 36 : -36;
    slideOpacity.value = 0.15;
    slideTranslateX.value = initialOffset;
    scaleAnim.value = 0.95;

    slideOpacity.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
    slideTranslateX.value = withSpring(0, { damping: 18, stiffness: 140 });
    scaleAnim.value = withSpring(1, { damping: 16, stiffness: 130 });
  }, [pageIdx, slideDirection]);

  const floatAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  const slideAnimStyle = useAnimatedStyle(() => ({
    opacity: slideOpacity.value,
    transform: [
      { translateX: slideTranslateX.value },
      { scale: scaleAnim.value },
    ],
  }));

  const loadSavedTheme = async () => {
    try {
      const saved = await AsyncStorage.getItem('app_splash_theme_pref');
      if (saved === 'dark' || saved === 'light') {
        setTheme(saved);
      }
    } catch (e) {
      console.log('Error loading splash theme preference:', e);
    }
  };

  const toggleTheme = async () => {
    haptic();
    const nextTheme: SplashTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    try {
      await AsyncStorage.setItem('app_splash_theme_pref', nextTheme);
    } catch (e) {
      console.log('Error saving splash theme preference:', e);
    }
  };

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
          await new Promise(resolve => setTimeout(resolve, 500));
          const retryResult = await supabase.auth.getSession();
          session = retryResult.data.session;
        }
      }

      if (session?.user) {
        await AsyncStorage.setItem('has_active_session', 'true');
        await AsyncStorage.setItem('app_unlocked', 'true');
        setHasValidSession(true);
      } else {
        await AsyncStorage.removeItem('has_active_session');
        await AsyncStorage.removeItem('app_unlocked');
        setHasValidSession(false);
      }
    } catch (e) {
      console.log('Session check notice:', e);
    } finally {
      setIsAuthChecking(false);
    }
  };

  const loadCustomSplashImages = async () => {
    try {
      const cached = await AsyncStorage.getItem('cached_splash_slides_v2');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length >= 1) {
          const imgs = parsed.map((s: any) => s.url || null);
          setCustomSlideImages([imgs[0] ?? null, imgs[1] ?? null, imgs[2] ?? null]);
        }
      }

      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'app_splash_slides')
        .maybeSingle();

      if (data?.value) {
        const val = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
        if (Array.isArray(val) && val.length >= 1) {
          const sorted = [...val].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          const imgs = sorted.map((s: any) => s.url || null);
          setCustomSlideImages([imgs[0] ?? null, imgs[1] ?? null, imgs[2] ?? null]);
          await AsyncStorage.setItem('cached_splash_slides_v2', JSON.stringify(sorted));
        }
      }
    } catch (e) {
      console.log('Splash custom images load error:', e);
    }
  };

  const haptic = useCallback(() => {
    if (Platform.OS !== 'web') {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    }
  }, []);

  // MANUAL NAVIGATION CONTROLS - ZERO AUTO SLIDE!
  const goTo = (idx: number) => {
    if (idx === pageIdx) return;
    haptic();
    setSlideDirection(idx > pageIdx ? 'forward' : 'backward');
    setPageIdx(idx);
  };

  const nextSlide = () => {
    haptic();
    if (pageIdx < 2) {
      setSlideDirection('forward');
      setPageIdx(p => p + 1);
    } else {
      router.push('/(auth)/signup' as any);
    }
  };

  const prevSlide = () => {
    haptic();
    if (pageIdx > 0) {
      setSlideDirection('backward');
      setPageIdx(p => p - 1);
    }
  };

  const skipAll = () => {
    haptic();
    setSlideDirection('forward');
    setPageIdx(2);
  };

  // TOUCH GESTURE - MANUAL SWIPE RECOGNITION
  const handleTouchStart = (e: any) => {
    touchStartX.current = e.nativeEvent.pageX;
    touchStartY.current = e.nativeEvent.pageY;
  };

  const handleTouchEnd = (e: any) => {
    const dx = e.nativeEvent.pageX - touchStartX.current;
    const dy = e.nativeEvent.pageY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 42) {
      if (dx < 0) {
        if (pageIdx < 2) nextSlide();
      } else {
        if (pageIdx > 0) prevSlide();
      }
    }
  };

  // ── LUXURY THEME PALETTE DEFINITIONS ──
  const isDark = theme === 'dark';
  const colors = {
    bgGradient: isDark
      ? (['#060C1B', '#0A142F', '#0E1E45'] as const)
      : (['#FFFFFF', '#FDFBF7', '#F5EFE6'] as const),
    statusBar: isDark ? ('light-content' as const) : ('dark-content' as const),
    textPrimary: isDark ? '#FFFFFF' : '#0D1B3E',
    textSecondary: isDark ? '#94A3B8' : '#64748B',
    textMuted: isDark ? '#64748B' : '#94A3B8',
    gold: isDark ? '#F59E0B' : '#D97706',
    goldGlow: isDark ? 'rgba(245, 158, 11, 0.4)' : 'rgba(217, 119, 6, 0.25)',
    cardBg: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.95)',
    cardBorder: isDark ? 'rgba(245, 158, 11, 0.25)' : '#E2E8F0',
    navBtnBg: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
    navBtnBorder: isDark ? 'rgba(245, 158, 11, 0.3)' : '#E2E8F0',
    logoBg: isDark ? '#0A1329' : '#FFFFFF',
    logoBorder: isDark ? 'rgba(245, 158, 11, 0.5)' : '#FEF3C7',
    badgeBg: isDark ? 'rgba(245, 158, 11, 0.14)' : 'rgba(217, 119, 6, 0.1)',
    badgeBorder: isDark ? 'rgba(245, 158, 11, 0.35)' : 'rgba(217, 119, 6, 0.25)',
    btnPrimaryBg: isDark ? (['#F59E0B', '#D97706'] as const) : (['#081026', '#050A18'] as const),
    btnPrimaryTxt: isDark ? '#060B18' : '#F59E0B',
    btnSecondaryBg: isDark ? 'rgba(15, 23, 42, 0.85)' : '#FFFFFF',
    btnSecondaryBorder: isDark ? 'rgba(245, 158, 11, 0.35)' : '#E2E8F0',
    btnSecondaryTxt: isDark ? '#F8FAFC' : '#0D1B3E',
    dotInactive: isDark ? 'rgba(255, 255, 255, 0.22)' : '#CBD5E1',
    dotActive: isDark ? '#F59E0B' : '#D97706',
  };

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.screenBg}>
      <StatusBar barStyle={colors.statusBar} backgroundColor="transparent" translucent />

      <View
        style={[
          styles.container,
          {
            paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 44 : 26) + 4,
            paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 34 : 20) + 8,
          },
        ]}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* ── TOP NAV BAR (Back Chevron, Theme Switcher, Skip Button) ── */}
        <View style={styles.topNav}>
          {/* Back Button or Spacer */}
          {pageIdx > 0 ? (
            <TouchableOpacity
              onPress={prevSlide}
              style={[
                styles.navBtn,
                { backgroundColor: colors.navBtnBg, borderColor: colors.navBtnBorder },
              ]}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          ) : (
            <View style={styles.navPlaceholder} />
          )}

          {/* Centered Quick Session Resume Pill if Already Logged In */}
          {hasValidSession && (
            <TouchableOpacity
              onPress={() => router.replace('/dashboard' as any)}
              style={[
                styles.resumeSessionPill,
                { backgroundColor: colors.badgeBg, borderColor: colors.badgeBorder },
              ]}
              activeOpacity={0.8}
            >
              <Ionicons name="sparkles" size={13} color={colors.gold} />
              <Text style={[styles.resumeSessionTxt, { color: colors.gold }]}>Go to Dashboard</Text>
              <Ionicons name="arrow-forward" size={12} color={colors.gold} />
            </TouchableOpacity>
          )}

          {/* Right Action Group: Theme Toggle & Skip */}
          <View style={styles.topRightActions}>
            {/* 🌙 / ☀️ THEME SWITCHER */}
            <TouchableOpacity
              onPress={toggleTheme}
              style={[
                styles.themeToggleBtn,
                { backgroundColor: colors.navBtnBg, borderColor: colors.navBtnBorder },
              ]}
              activeOpacity={0.75}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            >
              <Ionicons
                name={isDark ? 'sunny' : 'moon'}
                size={16}
                color={isDark ? '#F59E0B' : '#0D1B3E'}
              />
              <Text style={[styles.themeToggleTxt, { color: colors.textPrimary }]}>
                {isDark ? 'Light' : 'Dark'}
              </Text>
            </TouchableOpacity>

            {/* Skip Button (Shown on Slide 0 and 1) */}
            {pageIdx < 2 && (
              <TouchableOpacity
                onPress={skipAll}
                style={[
                  styles.skipBtn,
                  { backgroundColor: colors.navBtnBg, borderColor: colors.navBtnBorder },
                ]}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                activeOpacity={0.7}
              >
                <Text style={[styles.skipTxt, { color: colors.textPrimary }]}>Skip</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── LUXURY BRAND HEADER ── */}
        <View style={styles.brandHeader}>
          <View
            style={[
              styles.logoRingWrapper,
              {
                backgroundColor: colors.logoBg,
                borderColor: colors.logoBorder,
                shadowColor: colors.gold,
              },
            ]}
          >
            <Image
              source={require('../assets/images/am_luxury_logo.png')}
              style={styles.luxuryLogo}
              resizeMode="contain"
            />
          </View>

          <Text style={[styles.brandTitle, { color: colors.textPrimary }]}>ABU MAFHAL</Text>

          <View style={styles.subRow}>
            <View style={[styles.subLine, { backgroundColor: colors.gold }]} />
            <Text style={[styles.subText, { color: colors.gold }]}>S U B</Text>
            <View style={[styles.subLine, { backgroundColor: colors.gold }]} />
          </View>

          <Text style={[styles.tagline, { color: colors.textSecondary }]}>
            Elevated Digital Payments & Global Access
          </Text>
        </View>

        {/* ── ANIMATED SLIDE BODY (NO AUTO SLIDE - SMOOTH INTERACTIVE TRANSITION) ── */}
        <Animated.View style={[styles.slideBody, slideAnimStyle]}>
          {/* ══════════════════════════════════════════════════════════════
               SLIDE 0: 3D GLOBE - GLOBAL FINTECH GATEWAY
               ══════════════════════════════════════════════════════════════ */}
          {pageIdx === 0 && (
            <View style={styles.slideInner}>
              {/* Top Badge Pill */}
              <View
                style={[
                  styles.featureBadge,
                  { backgroundColor: colors.badgeBg, borderColor: colors.badgeBorder },
                ]}
              >
                <Ionicons name="sparkles" size={13} color={colors.gold} />
                <Text style={[styles.featureBadgeTxt, { color: colors.gold }]}>
                  GLOBAL FINTECH GATEWAY
                </Text>
              </View>

              {/* 3D Floating Globe Hero */}
              <View style={styles.heroCenter}>
                <Animated.View style={[styles.heroImgHolder, floatAnimStyle]}>
                  {customSlideImages[0] ? (
                    <Image
                      source={{ uri: customSlideImages[0]! }}
                      style={styles.heroImg}
                      resizeMode="contain"
                    />
                  ) : (
                    <Image
                      source={require('../assets/images/splash_globe_3d.png')}
                      style={styles.globeImg}
                      resizeMode="contain"
                    />
                  )}
                </Animated.View>
              </View>

              {/* Slide Content & Micro-features */}
              <View style={styles.slideFooterArea}>
                <Text style={[styles.slideMainHeading, { color: colors.textPrimary }]}>
                  Connect to Global Commerce
                </Text>
                <Text style={[styles.slideDescription, { color: colors.textSecondary }]}>
                  Your premier destination for instant mobile topups, virtual USD cards, electricity tokens, and international bills.
                </Text>

                {/* 3 Feature Pills */}
                <View style={styles.featureChipsRow}>
                  <View
                    style={[
                      styles.chipItem,
                      { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
                    ]}
                  >
                    <Ionicons name="flash" size={12} color={colors.gold} />
                    <Text style={[styles.chipTxt, { color: colors.textPrimary }]}>Sub-second VTU</Text>
                  </View>
                  <View
                    style={[
                      styles.chipItem,
                      { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
                    ]}
                  >
                    <Ionicons name="card" size={12} color={colors.gold} />
                    <Text style={[styles.chipTxt, { color: colors.textPrimary }]}>Virtual Cards</Text>
                  </View>
                  <View
                    style={[
                      styles.chipItem,
                      { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
                    ]}
                  >
                    <Ionicons name="shield-checkmark" size={12} color={colors.gold} />
                    <Text style={[styles.chipTxt, { color: colors.textPrimary }]}>Bank-Grade</Text>
                  </View>
                </View>

                {/* Next Slide CTA Pill Button */}
                <TouchableOpacity
                  onPress={nextSlide}
                  style={styles.slideActionPillBtn}
                  activeOpacity={0.88}
                >
                  <LinearGradient
                    colors={colors.btnPrimaryBg}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.slideActionPillGrad}
                  >
                    <Text style={[styles.slideActionPillTxt, { color: colors.btnPrimaryTxt }]}>
                      Explore Services
                    </Text>
                    <Ionicons name="arrow-forward" size={16} color={colors.btnPrimaryTxt} />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ══════════════════════════════════════════════════════════════
               SLIDE 1: 3D PHONE HUB - ALL-IN-ONE AUTOMATION
               ══════════════════════════════════════════════════════════════ */}
          {pageIdx === 1 && (
            <View style={styles.slideInner}>
              {/* Top Badge Pill */}
              <View
                style={[
                  styles.featureBadge,
                  { backgroundColor: colors.badgeBg, borderColor: colors.badgeBorder },
                ]}
              >
                <Ionicons name="phone-portrait-outline" size={13} color={colors.gold} />
                <Text style={[styles.featureBadgeTxt, { color: colors.gold }]}>
                  SEAMLESS AUTOMATION
                </Text>
              </View>

              {/* 3D Hub Phone Hero */}
              <View style={styles.heroCenter}>
                <Animated.View style={[styles.heroImgHolder, floatAnimStyle]}>
                  {customSlideImages[1] ? (
                    <Image
                      source={{ uri: customSlideImages[1]! }}
                      style={styles.heroImg}
                      resizeMode="contain"
                    />
                  ) : (
                    <Image
                      source={require('../assets/images/splash_hub_phone_3d.png')}
                      style={styles.hubPhoneImg}
                      resizeMode="contain"
                    />
                  )}
                </Animated.View>
              </View>

              {/* Slide Content & Service Highlights */}
              <View style={styles.slideFooterArea}>
                <Text style={[styles.slideMainHeading, { color: colors.textPrimary }]}>
                  All-in-One Digital Powerhouse
                </Text>
                <Text style={[styles.slideDescription, { color: colors.textSecondary }]}>
                  Enjoy blazing-fast automated delivery, zero downtime, and real-time transaction updates 24 hours a day.
                </Text>

                {/* 4 Quick Category Tags */}
                <View style={styles.servicePillGrid}>
                  <View
                    style={[
                      styles.serviceTag,
                      { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
                    ]}
                  >
                    <Ionicons name="wifi" size={13} color={colors.gold} />
                    <Text style={[styles.serviceTagTxt, { color: colors.textPrimary }]}>Data & Airtime</Text>
                  </View>
                  <View
                    style={[
                      styles.serviceTag,
                      { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
                    ]}
                  >
                    <Ionicons name="card-outline" size={13} color={colors.gold} />
                    <Text style={[styles.serviceTagTxt, { color: colors.textPrimary }]}>Virtual USD</Text>
                  </View>
                  <View
                    style={[
                      styles.serviceTag,
                      { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
                    ]}
                  >
                    <Ionicons name="bulb-outline" size={13} color={colors.gold} />
                    <Text style={[styles.serviceTagTxt, { color: colors.textPrimary }]}>Electricity</Text>
                  </View>
                  <View
                    style={[
                      styles.serviceTag,
                      { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
                    ]}
                  >
                    <Ionicons name="tv-outline" size={13} color={colors.gold} />
                    <Text style={[styles.serviceTagTxt, { color: colors.textPrimary }]}>Cable TV</Text>
                  </View>
                </View>

                {/* Continue CTA */}
                <TouchableOpacity
                  onPress={nextSlide}
                  style={styles.slideActionPillBtn}
                  activeOpacity={0.88}
                >
                  <LinearGradient
                    colors={colors.btnPrimaryBg}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.slideActionPillGrad}
                  >
                    <Text style={[styles.slideActionPillTxt, { color: colors.btnPrimaryTxt }]}>
                      Continue
                    </Text>
                    <Ionicons name="arrow-forward" size={16} color={colors.btnPrimaryTxt} />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ══════════════════════════════════════════════════════════════
               SLIDE 2: VALUE PROPOSITIONS & GET STARTED ACTION
               ══════════════════════════════════════════════════════════════ */}
          {pageIdx === 2 && (
            <View style={styles.slideInner}>
              {/* Top Badge Pill */}
              <View
                style={[
                  styles.featureBadge,
                  { backgroundColor: colors.badgeBg, borderColor: colors.badgeBorder },
                ]}
              >
                <Ionicons name="shield-checkmark-outline" size={13} color={colors.gold} />
                <Text style={[styles.featureBadgeTxt, { color: colors.gold }]}>
                  TRUST & EXCELLENCE
                </Text>
              </View>

              {/* Subtle World Map Watermark in background */}
              <View style={styles.worldMapHolder} pointerEvents="none">
                <Image
                  source={require('../assets/images/splash_world_map_bg.png')}
                  style={[styles.worldMapImg, { opacity: isDark ? 0.2 : 0.35 }]}
                  resizeMode="contain"
                />
              </View>

              {/* Headline & Value Proposition Cards */}
              <View style={styles.slide2Content}>
                <Text style={[styles.slideMainHeading, { color: colors.textPrimary, marginBottom: 4 }]}>
                  Experience Luxury Fintech
                </Text>
                <Text style={[styles.slideDescription, { color: colors.textSecondary, marginBottom: 14 }]}>
                  Join thousands experiencing effortless transactions with institutional reliability.
                </Text>

                {/* 3 Value Proposition Cards */}
                <View style={styles.valuePropsRow}>
                  {/* Card 1: Bank-Grade Security */}
                  <View
                    style={[
                      styles.valueCard,
                      { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
                    ]}
                  >
                    <View style={[styles.valueIconBox, { backgroundColor: colors.badgeBg }]}>
                      <Ionicons name="shield-checkmark" size={20} color={colors.gold} />
                    </View>
                    <Text style={[styles.valueCardTitle, { color: colors.textPrimary }]}>
                      Secure{'\n'}Payments
                    </Text>
                    <Text style={[styles.valueCardSub, { color: colors.textMuted }]}>
                      256-bit SSL
                    </Text>
                  </View>

                  {/* Card 2: Instant Delivery */}
                  <View
                    style={[
                      styles.valueCard,
                      { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
                    ]}
                  >
                    <View style={[styles.valueIconBox, { backgroundColor: colors.badgeBg }]}>
                      <Ionicons name="flash" size={20} color={colors.gold} />
                    </View>
                    <Text style={[styles.valueCardTitle, { color: colors.textPrimary }]}>
                      Instant{'\n'}Delivery
                    </Text>
                    <Text style={[styles.valueCardSub, { color: colors.textMuted }]}>
                      Sub-second
                    </Text>
                  </View>

                  {/* Card 3: 24/7 VIP Support */}
                  <View
                    style={[
                      styles.valueCard,
                      { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
                    ]}
                  >
                    <View style={[styles.valueIconBox, { backgroundColor: colors.badgeBg }]}>
                      <Ionicons name="headset" size={20} color={colors.gold} />
                    </View>
                    <Text style={[styles.valueCardTitle, { color: colors.textPrimary }]}>
                      24/7 VIP{'\n'}Support
                    </Text>
                    <Text style={[styles.valueCardSub, { color: colors.textMuted }]}>
                      Live Chat
                    </Text>
                  </View>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionsContainer}>
                {/* Primary CTA: Get Started */}
                <TouchableOpacity
                  onPress={() => {
                    haptic();
                    router.push('/(auth)/signup' as any);
                  }}
                  activeOpacity={0.88}
                  style={styles.primaryBtnWrapper}
                >
                  <LinearGradient
                    colors={colors.btnPrimaryBg}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryGetStartedBtn}
                  >
                    <Text style={[styles.primaryGetStartedTxt, { color: colors.btnPrimaryTxt }]}>
                      Get Started
                    </Text>
                    <Ionicons name="arrow-forward" size={18} color={colors.btnPrimaryTxt} />
                  </LinearGradient>
                </TouchableOpacity>

                {/* Secondary CTA: I Already Have an Account */}
                <TouchableOpacity
                  onPress={() => {
                    haptic();
                    router.push('/(auth)/login' as any);
                  }}
                  activeOpacity={0.8}
                  style={[
                    styles.secondaryAccountBtn,
                    {
                      backgroundColor: colors.btnSecondaryBg,
                      borderColor: colors.btnSecondaryBorder,
                    },
                  ]}
                >
                  <Text style={[styles.secondaryAccountTxt, { color: colors.btnSecondaryTxt }]}>
                    I Already Have an Account
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Architectural Skyline Silhouette at bottom */}
              <View style={styles.skylineHolder} pointerEvents="none">
                <Image
                  source={require('../assets/images/splash_skyline_3d.png')}
                  style={[styles.skylineImg, { opacity: isDark ? 0.35 : 0.6 }]}
                  resizeMode="contain"
                />
              </View>
            </View>
          )}
        </Animated.View>

        {/* ── INTERACTIVE PAGINATION CAPSULES (TAP TO NAVIGATE) ── */}
        <View style={styles.paginationArea}>
          <View style={styles.paginationRow}>
            {[0, 1, 2].map(idx => {
              const isActive = pageIdx === idx;
              return (
                <TouchableOpacity
                  key={idx}
                  onPress={() => goTo(idx)}
                  hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
                  style={styles.dotTouchTarget}
                  activeOpacity={0.7}
                >
                  {isActive ? (
                    <View
                      style={[
                        styles.dotActiveCapsule,
                        {
                          backgroundColor: colors.dotActive,
                          shadowColor: colors.dotActive,
                        },
                      ]}
                    />
                  ) : (
                    <View
                      style={[
                        styles.dotInactive,
                        { backgroundColor: colors.dotInactive },
                      ]}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screenBg: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 440,
    paddingHorizontal: 22,
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // ── Top Navigation Bar ──
  topNav: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 40,
    zIndex: 20,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  navPlaceholder: {
    width: 36,
    height: 36,
  },
  resumeSessionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  resumeSessionTxt: {
    fontSize: 12,
    fontWeight: '700',
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  themeToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  themeToggleTxt: {
    fontSize: 12,
    fontWeight: '700',
  },
  skipBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  skipTxt: {
    fontSize: 12.5,
    fontWeight: '700',
  },

  // ── Luxury Brand Header ──
  brandHeader: {
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 4,
  },
  logoRingWrapper: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 9,
    borderWidth: 2,
    marginBottom: 8,
  },
  luxuryLogo: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  brandTitle: {
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 10,
  },
  subLine: {
    width: 30,
    height: 1.5,
    borderRadius: 1,
  },
  subText: {
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 4.5,
  },
  tagline: {
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },

  // ── Animated Slide Body ──
  slideBody: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    marginVertical: 4,
  },
  slideInner: {
    flex: 1,
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // ── Feature Badge ──
  featureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 2,
  },
  featureBadgeTxt: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },

  // ── Hero Images ──
  heroCenter: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImgHolder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImg: {
    width: SW * 0.72,
    height: SH * 0.33,
    maxWidth: 290,
    maxHeight: 270,
  },
  globeImg: {
    width: Math.min(SW * 0.74, 280),
    height: Math.min(SH * 0.35, 245),
  },
  hubPhoneImg: {
    width: Math.min(SW * 0.74, 275),
    height: Math.min(SH * 0.35, 245),
  },

  // ── Slide Content Typography & Elements ──
  slideFooterArea: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 6,
  },
  slideMainHeading: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.2,
    marginBottom: 5,
  },
  slideDescription: {
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 14,
    marginBottom: 12,
  },

  // ── Slide 0 Feature Chips ──
  featureChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  chipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  chipTxt: {
    fontSize: 11,
    fontWeight: '700',
  },

  // ── Slide 1 Service Grid ──
  servicePillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    marginBottom: 14,
    paddingHorizontal: 10,
  },
  serviceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  serviceTagTxt: {
    fontSize: 11,
    fontWeight: '700',
  },

  // ── Slide Action Buttons ──
  slideActionPillBtn: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  slideActionPillGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 24,
    paddingVertical: 11,
  },
  slideActionPillTxt: {
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // ── Slide 2: Value propositions & Actions ──
  worldMapHolder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 160,
    alignItems: 'center',
  },
  worldMapImg: {
    width: '100%',
    height: '100%',
  },
  slide2Content: {
    width: '100%',
    alignItems: 'center',
    marginTop: 6,
  },
  valuePropsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 9,
    width: '100%',
    marginBottom: 14,
  },
  valueCard: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  valueIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
  },
  valueCardTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 14,
    marginBottom: 2,
  },
  valueCardSub: {
    fontSize: 9.5,
    fontWeight: '600',
    textAlign: 'center',
  },

  // ── Slide 2 Action Buttons ──
  actionsContainer: {
    width: '100%',
    gap: 9,
    zIndex: 10,
    marginBottom: 4,
  },
  primaryBtnWrapper: {
    width: '100%',
    borderRadius: 26,
    overflow: 'hidden',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  primaryGetStartedBtn: {
    width: '100%',
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryGetStartedTxt: {
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  secondaryAccountBtn: {
    width: '100%',
    height: 48,
    borderRadius: 24,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryAccountTxt: {
    fontSize: 13.5,
    fontWeight: '700',
  },

  // ── Skyline Silhouette at Bottom ──
  skylineHolder: {
    width: '100%',
    height: 70,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 2,
  },
  skylineImg: {
    width: '100%',
    height: '100%',
  },

  // ── Interactive Pagination Area ──
  paginationArea: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 6,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dotTouchTarget: {
    padding: 4,
  },
  dotInactive: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActiveCapsule: {
    width: 28,
    height: 8,
    borderRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 3,
  },
});
