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
import { BlurView } from 'expo-blur';
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

type LuxuryTheme = 'pearl' | 'champagne';

export default function SplashScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // 0: Global Fintech Gateway, 1: All-in-One Digital Hub, 2: Institutional Value & Get Started
  const [pageIdx, setPageIdx] = useState(0);
  const [slideDirection, setSlideDirection] = useState<'forward' | 'backward'>('forward');
  const [theme, setTheme] = useState<LuxuryTheme>('pearl');
  const [hasValidSession, setHasValidSession] = useState(false);
  const [customSlideImages, setCustomSlideImages] = useState<(string | null)[]>([null, null, null]);
  const [adminLogoUrl, setAdminLogoUrl] = useState<string | null>(null);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isDragging = useRef(false);

  // Reanimated motions for fluid luxury levitation, drag-follow and slide entrance
  const floatY = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const slideOpacity = useSharedValue(1);
  const slideTranslateX = useSharedValue(0);
  const scaleAnim = useSharedValue(1);

  useEffect(() => {
    // 60fps smooth floating levitation on the hero image container
    floatY.value = withRepeat(
      withSequence(
        withTiming(-9, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2400, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    // Continuous breathing pulse for header logo halo and accents
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    loadSavedTheme();
    loadAdminConfig();
    checkAuthSession();
  }, []);

  // MANUAL ANIMATED SLIDE TRANSITION (ZERO AUTO-SLIDE!)
  useEffect(() => {
    const initialOffset = slideDirection === 'forward' ? 36 : -36;
    slideOpacity.value = 0.2;
    slideTranslateX.value = initialOffset;
    scaleAnim.value = 0.95;

    slideOpacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
    slideTranslateX.value = withSpring(0, { damping: 16, stiffness: 130 });
    scaleAnim.value = withSpring(1, { damping: 16, stiffness: 130 });
  }, [pageIdx, slideDirection]);

  const floatAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  const pulseAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
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
      const saved = await AsyncStorage.getItem('app_splash_luxury_theme');
      if (saved === 'pearl' || saved === 'champagne') {
        setTheme(saved);
      }
    } catch (e) {
      console.log('Theme load notice:', e);
    }
  };

  const toggleTheme = async () => {
    haptic();
    const nextTheme: LuxuryTheme = theme === 'pearl' ? 'champagne' : 'pearl';
    setTheme(nextTheme);
    try {
      await AsyncStorage.setItem('app_splash_luxury_theme', nextTheme);
    } catch (e) {
      console.log('Theme save notice:', e);
    }
  };

  // LOAD ADMIN CUSTOM SLIDE IMAGES / GIFS & LOGO FROM SUPABASE
  const loadAdminConfig = async () => {
    try {
      // 1. Check cached slide images
      const cached = await AsyncStorage.getItem('cached_splash_slides_v3');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const sorted = [...parsed].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          const urls = sorted.map((s: any) => s.url || null);
          setCustomSlideImages([urls[0] ?? null, urls[1] ?? null, urls[2] ?? null]);
        }
      }

      // 2. Fetch latest splash slides from admin app_settings (key: app_splash_slides)
      const { data: slidesData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'app_splash_slides')
        .maybeSingle();

      if (slidesData?.value) {
        const val = typeof slidesData.value === 'string' ? JSON.parse(slidesData.value) : slidesData.value;
        if (Array.isArray(val) && val.length > 0) {
          const sorted = [...val].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          const urls = sorted.map((s: any) => s.url || null);
          setCustomSlideImages([urls[0] ?? null, urls[1] ?? null, urls[2] ?? null]);
          await AsyncStorage.setItem('cached_splash_slides_v3', JSON.stringify(sorted));
        }
      }

      // 3. Fetch custom app logo if configured in admin (key: app_logo or app_logo_icon)
      const { data: logoData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'app_logo')
        .maybeSingle();

      if (logoData?.value) {
        let logoUrl = null;
        if (typeof logoData.value === 'string') {
          if (logoData.value.trim().startsWith('{')) {
            try {
              const parsed = JSON.parse(logoData.value);
              logoUrl = parsed.url || parsed.uri || logoData.value;
            } catch {
              logoUrl = logoData.value;
            }
          } else {
            logoUrl = logoData.value;
          }
        } else if (typeof logoData.value === 'object' && logoData.value !== null) {
          logoUrl = (logoData.value as any).url || (logoData.value as any).uri || null;
        }
        if (logoUrl) setAdminLogoUrl(logoUrl);
      }
    } catch (e) {
      console.log('Admin config load error:', e);
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
          await new Promise(resolve => setTimeout(resolve, 400));
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
      console.log('Session notice:', e);
    }
  };

  const haptic = useCallback(() => {
    if (Platform.OS !== 'web') {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    }
  }, []);

  // MANUAL SLIDE CONTROLS (STRICTLY NO AUTO-SLIDE!)
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

  // INTERACTIVE TOUCH DRAG GESTURE WITH REAL-TIME SLIDE FOLLOW
  const handleTouchStart = (e: any) => {
    touchStartX.current = e.nativeEvent.pageX;
    touchStartY.current = e.nativeEvent.pageY;
    isDragging.current = true;
  };

  const handleTouchMove = (e: any) => {
    if (!isDragging.current) return;
    const dx = e.nativeEvent.pageX - touchStartX.current;
    const dy = e.nativeEvent.pageY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy)) {
      slideTranslateX.value = dx * 0.35;
    }
  };

  const handleTouchEnd = (e: any) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const dx = e.nativeEvent.pageX - touchStartX.current;
    const dy = e.nativeEvent.pageY - touchStartY.current;

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 42) {
      if (dx < 0 && pageIdx < 2) {
        nextSlide();
      } else if (dx > 0 && pageIdx > 0) {
        prevSlide();
      } else {
        slideTranslateX.value = withSpring(0, { damping: 16, stiffness: 140 });
      }
    } else {
      slideTranslateX.value = withSpring(0, { damping: 16, stiffness: 140 });
    }
  };

  // ── LUXURY THEME PALETTES (100% BRIGHT & RADIANT, ZERO BLACK BACKGROUND) ──
  const isPearl = theme === 'pearl';
  const colors = isPearl
    ? {
        bgGradient: ['#FFFFFF', '#FDFBF7', '#F5EFE6'] as const,
        primaryText: '#0D1B3E',
        secondaryText: '#64748B',
        accentGold: '#D97706',
        accentGoldDark: '#B45309',
        cardBg: 'rgba(255, 255, 255, 0.88)',
        cardBorder: 'rgba(217, 119, 6, 0.32)',
        cardShadow: '#D97706',
        navBtnBg: 'rgba(255, 255, 255, 0.95)',
        navBtnBorder: '#E2E8F0',
        badgeBg: 'rgba(217, 119, 6, 0.1)',
        badgeBorder: 'rgba(217, 119, 6, 0.3)',
        badgeText: '#B45309',
        primaryBtnBg: ['#0D1B3E', '#060B18'] as const,
        primaryBtnText: '#F59E0B',
        secondaryBtnBg: '#FFFFFF',
        secondaryBtnBorder: '#E2E8F0',
        secondaryBtnText: '#0D1B3E',
        dotInactive: '#CBD5E1',
        dotActive: '#D97706',
        themeSwitchLabel: 'Champagne',
        themeSwitchIcon: 'color-palette-outline' as const,
      }
    : {
        bgGradient: ['#FFFDF9', '#FAF2E4', '#F0E2C8'] as const,
        primaryText: '#0A142F',
        secondaryText: '#57534E',
        accentGold: '#B45309',
        accentGoldDark: '#92400E',
        cardBg: 'rgba(255, 255, 255, 0.92)',
        cardBorder: 'rgba(180, 83, 9, 0.35)',
        cardShadow: '#B45309',
        navBtnBg: 'rgba(255, 255, 255, 0.95)',
        navBtnBorder: '#E7DEC8',
        badgeBg: 'rgba(180, 83, 9, 0.12)',
        badgeBorder: 'rgba(180, 83, 9, 0.32)',
        badgeText: '#92400E',
        primaryBtnBg: ['#1E1B4B', '#0D1B3E'] as const,
        primaryBtnText: '#FBBF24',
        secondaryBtnBg: '#FFFFFF',
        secondaryBtnBorder: '#E5D8BC',
        secondaryBtnText: '#0A142F',
        dotInactive: '#D6C7A8',
        dotActive: '#B45309',
        themeSwitchLabel: 'Pearl',
        themeSwitchIcon: 'sparkles-outline' as const,
      };

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.screenBg}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Decorative ambient glowing orbs */}
      <View style={styles.bgDecorationsHolder} pointerEvents="none">
        <View style={[styles.ambientOrbTop, { backgroundColor: isPearl ? '#FEF3C7' : '#FDE68A' }]} />
        <View style={[styles.ambientOrbBottom, { backgroundColor: isPearl ? '#F5EFE6' : '#F3E8D8' }]} />
      </View>

      <View
        style={[
          styles.container,
          {
            paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 44 : 26) + 4,
            paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 34 : 20) + 8,
          },
        ]}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* ── TOP NAV BAR (Back chevron, Theme Switcher, Skip Button) ── */}
        <View style={styles.topNav}>
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
              <Ionicons name="chevron-back" size={20} color={colors.primaryText} />
            </TouchableOpacity>
          ) : (
            <View style={styles.navPlaceholder} />
          )}

          {/* Quick Dashboard Resume Pill if Active Session */}
          {hasValidSession && (
            <TouchableOpacity
              onPress={() => router.replace('/dashboard' as any)}
              style={[
                styles.resumeSessionPill,
                { backgroundColor: colors.badgeBg, borderColor: colors.badgeBorder },
              ]}
              activeOpacity={0.8}
            >
              <Ionicons name="sparkles" size={12} color={colors.accentGold} />
              <Text style={[styles.resumeSessionTxt, { color: colors.accentGold }]}>
                Dashboard
              </Text>
              <Ionicons name="arrow-forward" size={11} color={colors.accentGold} />
            </TouchableOpacity>
          )}

          {/* Right Action Group: Theme Switcher & Skip Button */}
          <View style={styles.topRightActions}>
            <TouchableOpacity
              onPress={toggleTheme}
              style={[
                styles.themeToggleBtn,
                { backgroundColor: colors.navBtnBg, borderColor: colors.navBtnBorder },
              ]}
              activeOpacity={0.75}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            >
              <Ionicons name={colors.themeSwitchIcon} size={15} color={colors.accentGold} />
              <Text style={[styles.themeToggleTxt, { color: colors.primaryText }]}>
                {colors.themeSwitchLabel}
              </Text>
            </TouchableOpacity>

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
                <Text style={[styles.skipTxt, { color: colors.primaryText }]}>Skip</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── LUXURY BRAND HEADER WITH LARGER OFFICIAL LOGO & RICH DECORATION ── */}
        <View style={styles.brandHeader}>
          <Animated.View style={[styles.logoHaloGlow, pulseAnimStyle]}>
            {/* Outer golden halo ring */}
            <View style={styles.logoOuterHalo}>
              {/* Inner crisp logo ring */}
              <View style={styles.logoRingWrapper}>
                <Image
                  source={
                    adminLogoUrl
                      ? { uri: adminLogoUrl }
                      : require('../assets/images/logo.png')
                  }
                  style={styles.realBrandLogo}
                  resizeMode="contain"
                />
              </View>
            </View>
          </Animated.View>

          {/* Brand Title with Sparkles */}
          <View style={styles.brandTitleRow}>
            <Text style={[styles.brandStarIcon, { color: colors.accentGold }]}>✦</Text>
            <Text style={[styles.brandTitle, { color: colors.primaryText }]}>ABU MAFHAL</Text>
            <Text style={[styles.brandStarIcon, { color: colors.accentGold }]}>✦</Text>
          </View>

          {/* Luxury SUB Line with Diamond Accents */}
          <View style={styles.subRow}>
            <View style={[styles.subLine, { backgroundColor: colors.accentGold }]} />
            <Text style={[styles.subDiamond, { color: colors.accentGold }]}>◆</Text>
            <Text style={[styles.subText, { color: colors.accentGold }]}>S U B</Text>
            <Text style={[styles.subDiamond, { color: colors.accentGold }]}>◆</Text>
            <View style={[styles.subLine, { backgroundColor: colors.accentGold }]} />
          </View>

          <Text style={[styles.tagline, { color: colors.secondaryText }]}>
            Shop, Pay & Subscribe Globally
          </Text>
        </View>

        {/* ── ANIMATED SLIDE BODY (MANUAL SWIPE WITH FLUID REANIMATED MOTION) ── */}
        <Animated.View style={[styles.slideBody, slideAnimStyle]}>
          {/* ══════════════════════════════════════════════════════════════
               SLIDE 0: 3D GLOBE / ADMIN CUSTOM IMAGE IN BORDERED BLURRED CARD
               ══════════════════════════════════════════════════════════════ */}
          {pageIdx === 0 && (
            <View style={styles.slideInner}>
              <View
                style={[
                  styles.featureBadge,
                  { backgroundColor: colors.badgeBg, borderColor: colors.badgeBorder },
                ]}
              >
                <Ionicons name="sparkles" size={13} color={colors.accentGold} />
                <Text style={[styles.featureBadgeTxt, { color: colors.badgeText }]}>
                  GLOBAL FINTECH GATEWAY
                </Text>
              </View>

              {/* HERO VISUAL: BLURRED BORDERED CONTAINER WITH 3D IMAGE OR ADMIN GIF */}
              <View style={styles.heroCenter}>
                <Animated.View style={[styles.heroCardHolder, floatAnimStyle]}>
                  <View
                    style={[
                      styles.heroGlassContainer,
                      {
                        backgroundColor: colors.cardBg,
                        borderColor: colors.cardBorder,
                        shadowColor: colors.cardShadow,
                      },
                    ]}
                  >
                    {Platform.OS !== 'web' ? (
                      <BlurView intensity={65} tint="light" style={StyleSheet.absoluteFill} />
                    ) : null}

                    <LinearGradient
                      colors={['rgba(255,255,255,0.7)', 'rgba(254,243,199,0.3)', 'rgba(255,255,255,0.6)']}
                      style={StyleSheet.absoluteFill}
                    />

                    {/* Corner decorative golden accents */}
                    <View style={[styles.cornerStarTopLeft, { borderColor: colors.accentGold }]} />
                    <View style={[styles.cornerStarBottomRight, { borderColor: colors.accentGold }]} />

                    {/* HERO PICTURE: ADMIN CUSTOM IMAGE/GIF OR 3D GLOBE */}
                    <Image
                      source={
                        customSlideImages[0]
                          ? { uri: customSlideImages[0]! }
                          : require('../assets/images/splash_globe_3d.png')
                      }
                      style={styles.heroImageGlobe}
                      resizeMode="contain"
                    />

                    {/* Bottom Ticker Pill Inside Card */}
                    <View style={styles.cardStatusTicker}>
                      <View style={styles.greenPulseDot} />
                      <Text style={styles.cardStatusTickerTxt}>
                        Instant Global & Local Payments
                      </Text>
                    </View>
                  </View>
                </Animated.View>
              </View>

              {/* Slide Content & Action Button */}
              <View style={styles.slideFooterArea}>
                <Text style={[styles.slideMainHeading, { color: colors.primaryText }]}>
                  Your Gateway to Seamless Payments
                </Text>
                <Text style={[styles.slideDescription, { color: colors.secondaryText }]}>
                  Instant automated delivery for data bundles, airtime topups, utility bills, and worldwide virtual card transactions.
                </Text>

                {/* 3 Value Chips */}
                <View style={styles.featureChipsRow}>
                  <View style={styles.chipItem}>
                    <Ionicons name="flash" size={12} color={colors.accentGold} />
                    <Text style={[styles.chipTxt, { color: colors.primaryText }]}>Sub-second VTU</Text>
                  </View>
                  <View style={styles.chipItem}>
                    <Ionicons name="card" size={12} color={colors.accentGold} />
                    <Text style={[styles.chipTxt, { color: colors.primaryText }]}>Virtual USD</Text>
                  </View>
                  <View style={styles.chipItem}>
                    <Ionicons name="shield-checkmark" size={12} color={colors.accentGold} />
                    <Text style={[styles.chipTxt, { color: colors.primaryText }]}>Bank-Grade</Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={nextSlide}
                  style={styles.slideActionPillBtn}
                  activeOpacity={0.88}
                >
                  <LinearGradient
                    colors={colors.primaryBtnBg}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.slideActionPillGrad}
                  >
                    <Text style={[styles.slideActionPillTxt, { color: colors.primaryBtnText }]}>
                      Explore Services
                    </Text>
                    <Ionicons name="arrow-forward" size={16} color={colors.primaryBtnText} />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ══════════════════════════════════════════════════════════════
               SLIDE 1: 3D PHONE HUB / ADMIN CUSTOM IMAGE IN BORDERED BLURRED CARD
               ══════════════════════════════════════════════════════════════ */}
          {pageIdx === 1 && (
            <View style={styles.slideInner}>
              <View
                style={[
                  styles.featureBadge,
                  { backgroundColor: colors.badgeBg, borderColor: colors.badgeBorder },
                ]}
              >
                <Ionicons name="phone-portrait-outline" size={13} color={colors.accentGold} />
                <Text style={[styles.featureBadgeTxt, { color: colors.badgeText }]}>
                  ALL-IN-ONE AUTOMATION
                </Text>
              </View>

              {/* HERO VISUAL: BLURRED BORDERED CONTAINER WITH 3D PHONE OR ADMIN GIF */}
              <View style={styles.heroCenter}>
                <Animated.View style={[styles.heroCardHolder, floatAnimStyle]}>
                  <View
                    style={[
                      styles.heroGlassContainer,
                      {
                        backgroundColor: colors.cardBg,
                        borderColor: colors.cardBorder,
                        shadowColor: colors.cardShadow,
                      },
                    ]}
                  >
                    {Platform.OS !== 'web' ? (
                      <BlurView intensity={65} tint="light" style={StyleSheet.absoluteFill} />
                    ) : null}

                    <LinearGradient
                      colors={['rgba(255,255,255,0.7)', 'rgba(254,243,199,0.3)', 'rgba(255,255,255,0.6)']}
                      style={StyleSheet.absoluteFill}
                    />

                    {/* Corner decorative golden accents */}
                    <View style={[styles.cornerStarTopLeft, { borderColor: colors.accentGold }]} />
                    <View style={[styles.cornerStarBottomRight, { borderColor: colors.accentGold }]} />

                    {/* HERO PICTURE: ADMIN CUSTOM IMAGE/GIF OR 3D PHONE */}
                    <Image
                      source={
                        customSlideImages[1]
                          ? { uri: customSlideImages[1]! }
                          : require('../assets/images/splash_hub_phone_3d.png')
                      }
                      style={styles.heroImagePhone}
                      resizeMode="contain"
                    />

                    {/* Bottom Ticker Pill Inside Card */}
                    <View style={styles.cardStatusTicker}>
                      <View style={styles.greenPulseDot} />
                      <Text style={styles.cardStatusTickerTxt}>
                        99.9% Automated Processing Uptime
                      </Text>
                    </View>
                  </View>
                </Animated.View>
              </View>

              {/* Slide Content & Action Button */}
              <View style={styles.slideFooterArea}>
                <Text style={[styles.slideMainHeading, { color: colors.primaryText }]}>
                  Your All-in-One Digital Hub
                </Text>
                <Text style={[styles.slideDescription, { color: colors.secondaryText }]}>
                  Fast, secure, and automated transactions. Manage all your airtime, data bundles, electricity, and cable TV in one spot.
                </Text>

                {/* 4 Service Pills */}
                <View style={styles.servicePillGrid}>
                  <View style={styles.serviceTag}>
                    <Ionicons name="wifi" size={12} color={colors.accentGold} />
                    <Text style={[styles.serviceTagTxt, { color: colors.primaryText }]}>Data & Airtime</Text>
                  </View>
                  <View style={styles.serviceTag}>
                    <Ionicons name="card" size={12} color={colors.accentGold} />
                    <Text style={[styles.serviceTagTxt, { color: colors.primaryText }]}>Virtual USD</Text>
                  </View>
                  <View style={styles.serviceTag}>
                    <Ionicons name="bulb" size={12} color={colors.accentGold} />
                    <Text style={[styles.serviceTagTxt, { color: colors.primaryText }]}>Electricity</Text>
                  </View>
                  <View style={styles.serviceTag}>
                    <Ionicons name="tv" size={12} color={colors.accentGold} />
                    <Text style={[styles.serviceTagTxt, { color: colors.primaryText }]}>Cable TV</Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={nextSlide}
                  style={styles.slideActionPillBtn}
                  activeOpacity={0.88}
                >
                  <LinearGradient
                    colors={colors.primaryBtnBg}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.slideActionPillGrad}
                  >
                    <Text style={[styles.slideActionPillTxt, { color: colors.primaryBtnText }]}>
                      Continue
                    </Text>
                    <Ionicons name="arrow-forward" size={16} color={colors.primaryBtnText} />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ══════════════════════════════════════════════════════════════
               SLIDE 2: 3D CARD STACK / ADMIN CUSTOM IMAGE & GET STARTED
               ══════════════════════════════════════════════════════════════ */}
          {pageIdx === 2 && (
            <View style={styles.slideInner}>
              <View
                style={[
                  styles.featureBadge,
                  { backgroundColor: colors.badgeBg, borderColor: colors.badgeBorder },
                ]}
              >
                <Ionicons name="shield-checkmark-outline" size={13} color={colors.accentGold} />
                <Text style={[styles.featureBadgeTxt, { color: colors.badgeText }]}>
                  TRUST, SPEED & SECURITY
                </Text>
              </View>

              {/* HERO VISUAL: BLURRED BORDERED CONTAINER WITH 3D CARD STACK OR ADMIN GIF */}
              <View style={styles.heroCenter}>
                <Animated.View style={[styles.heroCardHolder, floatAnimStyle]}>
                  <View
                    style={[
                      styles.heroGlassContainer,
                      {
                        backgroundColor: colors.cardBg,
                        borderColor: colors.cardBorder,
                        shadowColor: colors.cardShadow,
                      },
                    ]}
                  >
                    {Platform.OS !== 'web' ? (
                      <BlurView intensity={65} tint="light" style={StyleSheet.absoluteFill} />
                    ) : null}

                    <LinearGradient
                      colors={['rgba(255,255,255,0.7)', 'rgba(254,243,199,0.3)', 'rgba(255,255,255,0.6)']}
                      style={StyleSheet.absoluteFill}
                    />

                    {/* Corner decorative golden accents */}
                    <View style={[styles.cornerStarTopLeft, { borderColor: colors.accentGold }]} />
                    <View style={[styles.cornerStarBottomRight, { borderColor: colors.accentGold }]} />

                    {/* HERO PICTURE: ADMIN CUSTOM IMAGE/GIF OR 3D CARD STACK */}
                    <Image
                      source={
                        customSlideImages[2]
                          ? { uri: customSlideImages[2]! }
                          : require('../assets/images/vc_card_stack_3d_real.png')
                      }
                      style={styles.heroImageCardStack}
                      resizeMode="contain"
                    />

                    {/* Bottom Ticker Pill Inside Card */}
                    <View style={styles.cardStatusTicker}>
                      <Ionicons name="shield-checkmark" size={11} color="#16A34A" />
                      <Text style={styles.cardStatusTickerTxt}>
                        Bank-Grade 256-bit Encryption
                      </Text>
                    </View>
                  </View>
                </Animated.View>
              </View>

              {/* Action Buttons & Value Cards */}
              <View style={styles.slide2ActionFooter}>
                <Text style={[styles.slideMainHeading, { color: colors.primaryText, marginBottom: 3 }]}>
                  Experience Luxury Fintech
                </Text>
                <Text style={[styles.slideDescription, { color: colors.secondaryText, marginBottom: 10 }]}>
                  Join thousands enjoying seamless transactions nationwide with institutional security.
                </Text>

                {/* 3 Value Proposition Cards */}
                <View style={styles.valuePropsRow}>
                  <View style={styles.valueCard}>
                    <Ionicons name="shield-checkmark" size={18} color={colors.accentGold} />
                    <Text style={[styles.valueCardTitle, { color: colors.primaryText }]}>
                      Secure Payments
                    </Text>
                  </View>
                  <View style={styles.valueCard}>
                    <Ionicons name="globe-outline" size={18} color={colors.accentGold} />
                    <Text style={[styles.valueCardTitle, { color: colors.primaryText }]}>
                      Global Access
                    </Text>
                  </View>
                  <View style={styles.valueCard}>
                    <Ionicons name="flash" size={18} color={colors.accentGold} />
                    <Text style={[styles.valueCardTitle, { color: colors.primaryText }]}>
                      Fast & Reliable
                    </Text>
                  </View>
                </View>

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
                      colors={colors.primaryBtnBg}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.primaryGetStartedBtn}
                    >
                      <Text style={[styles.primaryGetStartedTxt, { color: colors.primaryBtnText }]}>
                        Get Started
                      </Text>
                      <Ionicons name="arrow-forward" size={18} color={colors.primaryBtnText} />
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
                        backgroundColor: colors.secondaryBtnBg,
                        borderColor: colors.secondaryBtnBorder,
                      },
                    ]}
                  >
                    <Text style={[styles.secondaryAccountTxt, { color: colors.secondaryBtnText }]}>
                      I Already Have an Account
                    </Text>
                  </TouchableOpacity>
                </View>
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
  bgDecorationsHolder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  ambientOrbTop: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 230,
    height: 230,
    borderRadius: 115,
    opacity: 0.45,
  },
  ambientOrbBottom: {
    position: 'absolute',
    bottom: -40,
    left: -40,
    width: 210,
    height: 210,
    borderRadius: 105,
    opacity: 0.5,
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 440,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 1,
  },

  // ── Top Navigation Bar ──
  topNav: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 38,
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
    shadowOpacity: 0.06,
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
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  themeToggleTxt: {
    fontSize: 12,
    fontWeight: '700',
  },
  skipBtn: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  skipTxt: {
    fontSize: 12.5,
    fontWeight: '700',
  },

  // ── Luxury Brand Header With Larger Official Logo & Rich Decoration ──
  brandHeader: {
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 4,
  },
  logoHaloGlow: {
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 5,
  },
  logoOuterHalo: {
    width: 98,
    height: 98,
    borderRadius: 49,
    padding: 3,
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: 'rgba(217, 119, 6, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoRingWrapper: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FEF3C7',
  },
  realBrandLogo: {
    width: 78,
    height: 78,
    borderRadius: 39,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandStarIcon: {
    fontSize: 11,
    fontWeight: '900',
  },
  brandTitle: {
    fontSize: 20.5,
    fontWeight: '900',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 6,
  },
  subLine: {
    width: 24,
    height: 1.5,
    borderRadius: 1,
  },
  subDiamond: {
    fontSize: 9,
  },
  subText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 4,
  },
  tagline: {
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 3,
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
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 2,
  },
  featureBadgeTxt: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },

  // ── HERO VISUAL CONTAINER (BLUR + BORDER + SHADOW) ──
  heroCenter: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCardHolder: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  heroGlassContainer: {
    width: Math.min(SW * 0.88, 335),
    height: Math.min(SH * 0.35, 260),
    borderRadius: 24,
    borderWidth: 1.5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 6,
    position: 'relative',
    paddingVertical: 8,
  },
  cornerStarTopLeft: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 14,
    height: 14,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRadius: 2,
    opacity: 0.6,
    zIndex: 5,
  },
  cornerStarBottomRight: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 14,
    height: 14,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderRadius: 2,
    opacity: 0.6,
    zIndex: 5,
  },

  // ── HERO IMAGES ──
  heroImageGlobe: {
    width: Math.min(SW * 0.78, 270),
    height: Math.min(SH * 0.28, 215),
    zIndex: 2,
  },
  heroImagePhone: {
    width: Math.min(SW * 0.78, 265),
    height: Math.min(SH * 0.28, 215),
    zIndex: 2,
  },
  heroImageCardStack: {
    width: Math.min(SW * 0.80, 280),
    height: Math.min(SH * 0.26, 195),
    zIndex: 2,
  },

  cardStatusTicker: {
    position: 'absolute',
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    zIndex: 10,
  },
  greenPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  cardStatusTickerTxt: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#0D1B3E',
  },

  // ── Slide Content Typography & Buttons ──
  slideFooterArea: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 4,
  },
  slide2ActionFooter: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 2,
  },
  slideMainHeading: {
    fontSize: 18.5,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  slideDescription: {
    fontSize: 11.5,
    lineHeight: 16.5,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 12,
    marginBottom: 8,
  },

  // ── Slide 0 Feature Chips ──
  featureChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginBottom: 10,
  },
  chipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  chipTxt: {
    fontSize: 10.5,
    fontWeight: '700',
  },

  // ── Slide 1 Service Grid ──
  servicePillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
    marginBottom: 10,
    paddingHorizontal: 8,
  },
  serviceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  serviceTagTxt: {
    fontSize: 10.5,
    fontWeight: '700',
  },

  // ── Slide Action Buttons ──
  slideActionPillBtn: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#0D1B3E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },
  slideActionPillGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 26,
    paddingVertical: 10,
  },
  slideActionPillTxt: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // ── Slide 2 Value Props Row ──
  valuePropsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 7,
    marginBottom: 10,
  },
  valueCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  valueCardTitle: {
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },

  // ── Slide 2 Action Buttons ──
  actionsContainer: {
    width: '100%',
    gap: 7,
    zIndex: 10,
  },
  primaryBtnWrapper: {
    width: '100%',
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: '#0D1B3E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryGetStartedBtn: {
    width: '100%',
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryGetStartedTxt: {
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  secondaryAccountBtn: {
    width: '100%',
    height: 44,
    borderRadius: 22,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryAccountTxt: {
    fontSize: 12.5,
    fontWeight: '700',
  },

  // ── Interactive Pagination Area ──
  paginationArea: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 3,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
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
    width: 26,
    height: 8,
    borderRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
});
