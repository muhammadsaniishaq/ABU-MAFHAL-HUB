import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Platform,
  StatusBar,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  useWindowDimensions,
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
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { supabase, processOAuthReturn } from '../services/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type LuxuryTheme = 'pearl' | 'champagne';

export default function SplashScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const slideWidth = Math.min(windowWidth, 430);

  // 0: Global Fintech Gateway, 1: All-in-One Digital Hub, 2: Institutional Value & Get Started
  const [pageIdx, setPageIdx] = useState(0);
  const [theme, setTheme] = useState<LuxuryTheme>('pearl');
  const [hasValidSession, setHasValidSession] = useState(false);
  const [customSlideImages, setCustomSlideImages] = useState<(string | null)[]>([null, null, null]);
  const [adminLogoUrl, setAdminLogoUrl] = useState<string | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);

  // Reanimated motions for fluid luxury levitation, complementary orbit badges, and breathing logo
  const floatY = useSharedValue(0);
  const floatYReverse = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    // Smooth 60fps levitation for primary hero card & left orbital chip
    floatY.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2500, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    // Staggered complementary levitation for right orbital chip
    floatYReverse.value = withRepeat(
      withSequence(
        withTiming(8, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
        withTiming(-4, { duration: 2800, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    // Continuous breathing pulse for brand logo halo ring
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    loadSavedTheme();
    loadAdminConfig();
    checkAuthSession();

    // Listen for realtime splash slide updates from admin
    const channel = supabase
      .channel('public:app_settings:splash_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings', filter: 'key=eq.app_splash_slides' }, (payload) => {
        if (payload?.new && (payload.new as any).value) {
          const fresh = extractSlideUrls((payload.new as any).value);
          setCustomSlideImages(fresh);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const floatAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  const floatReverseAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatYReverse.value }],
  }));

  const pulseAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
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

  // HELPER: Extract guaranteed URLs for [Page 1, Page 2, Page 3]
  const extractSlideUrls = (raw: any): (string | null)[] => {
    if (!raw) return [null, null, null];
    let parsed = raw;
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch {}
    }
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch {}
    }
    if (!Array.isArray(parsed)) return [null, null, null];

    const s0 = parsed.find((s: any) => s.order === 0)?.url;
    const s1 = parsed.find((s: any) => s.order === 1)?.url;
    const s2 = parsed.find((s: any) => s.order === 2)?.url;

    return [
      s0 && typeof s0 === 'string' && s0.trim().length > 0 ? s0.trim() : null,
      s1 && typeof s1 === 'string' && s1.trim().length > 0 ? s1.trim() : null,
      s2 && typeof s2 === 'string' && s2.trim().length > 0 ? s2.trim() : null,
    ];
  };

  // LOAD ADMIN CUSTOM SLIDE IMAGES / GIFS & LOGO FROM SUPABASE
  const loadAdminConfig = async () => {
    try {
      // 1. Check cached slide images
      const cached = await AsyncStorage.getItem('cached_splash_slides_v3');
      if (cached) {
        const cachedUrls = extractSlideUrls(cached);
        setCustomSlideImages(cachedUrls);
      }

      // 2. Fetch latest splash slides from admin app_settings (key: app_splash_slides)
      const { data: slidesData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'app_splash_slides')
        .maybeSingle();

      if (slidesData?.value) {
        const freshUrls = extractSlideUrls(slidesData.value);
        setCustomSlideImages(freshUrls);
        let slidesToStore = slidesData.value;
        if (typeof slidesToStore !== 'string') {
          slidesToStore = JSON.stringify(slidesToStore);
        }
        await AsyncStorage.setItem('cached_splash_slides_v3', slidesToStore);
      }

      // 3. Fetch custom app logo if configured in admin (key: app_logo)
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

  // MANUAL & SWIPE SLIDE NAVIGATION
  const goTo = (idx: number) => {
    if (idx < 0 || idx > 2) return;
    haptic();
    setPageIdx(idx);
    scrollViewRef.current?.scrollTo({ x: idx * slideWidth, animated: true });
  };

  const nextSlide = () => {
    if (pageIdx < 2) {
      goTo(pageIdx + 1);
    } else {
      haptic();
      router.push('/(auth)/signup' as any);
    }
  };

  const prevSlide = () => {
    if (pageIdx > 0) {
      goTo(pageIdx - 1);
    }
  };

  const skipAll = () => {
    goTo(2);
  };

  // NATIVE HORIZONTAL SWIPE EVENT HANDLER
  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const newIdx = Math.round(offsetX / slideWidth);
    if (newIdx !== pageIdx && newIdx >= 0 && newIdx <= 2) {
      haptic();
      setPageIdx(newIdx);
    }
  };

  // LUXURY THEME PALETTES (100% BRIGHT & RADIANT, ZERO HARSH BLACK BACKGROUND)
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

      {/* Ambient background glowing orbs */}
      <View style={styles.bgDecorationsHolder} pointerEvents="none">
        <View style={[styles.ambientOrbTop, { backgroundColor: isPearl ? '#FEF3C7' : '#FDE68A' }]} />
        <View style={[styles.ambientOrbBottom, { backgroundColor: isPearl ? '#F5EFE6' : '#F3E8D8' }]} />
        {/* Subtle connected constellation particle lines in background */}
        <View style={styles.constellationRing} />
      </View>

      <View
        style={[
          styles.container,
          {
            paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 44 : 24) + 2,
            paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 34 : 20) + 4,
          },
        ]}
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

        {/* ── COMPACT LUXURY BRAND CREST (PRESERVES MAXIMUM VERTICAL ROOM FOR TALL HERO VISUAL) ── */}
        <View style={styles.brandHeader}>
          <Animated.View style={[styles.logoHaloGlow, pulseAnimStyle]}>
            <View style={styles.logoOuterHalo}>
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

          <View style={styles.brandTitleRow}>
            <Text style={[styles.brandStarIcon, { color: colors.accentGold }]}>✦</Text>
            <Text style={[styles.brandTitle, { color: colors.primaryText }]}>ABU MAFHAL</Text>
            <Text style={[styles.brandStarIcon, { color: colors.accentGold }]}>✦</Text>
          </View>

          <View style={styles.subRow}>
            <View style={[styles.subLine, { backgroundColor: colors.accentGold }]} />
            <Text style={[styles.subDiamond, { color: colors.accentGold }]}>◆</Text>
            <Text style={[styles.subText, { color: colors.accentGold }]}>S U B</Text>
            <Text style={[styles.subDiamond, { color: colors.accentGold }]}>◆</Text>
            <View style={[styles.subLine, { backgroundColor: colors.accentGold }]} />
          </View>
        </View>

        {/* ── INTERCONNECTED PROGRESS CONSTELLATION TIMELINE (CONNECTED DECORATION) ── */}
        <View style={styles.interconnectedProgressContainer}>
          {/* Node 1: Gateway */}
          <TouchableOpacity
            onPress={() => goTo(0)}
            activeOpacity={0.8}
            style={styles.progressNodeWrapper}
          >
            <View
              style={[
                styles.progressNodeCircle,
                pageIdx === 0
                  ? [styles.progressNodeActive, { borderColor: colors.accentGold }]
                  : pageIdx > 0
                  ? [styles.progressNodeCompleted, { backgroundColor: colors.accentGold }]
                  : styles.progressNodeInactive,
              ]}
            >
              {pageIdx > 0 ? (
                <Ionicons name="checkmark" size={11} color="#FFFFFF" />
              ) : (
                <Text
                  style={[
                    styles.progressNodeText,
                    pageIdx === 0 && { color: colors.accentGold, fontWeight: '900' },
                  ]}
                >
                  1
                </Text>
              )}
            </View>
            <Text
              style={[
                styles.progressNodeLabel,
                pageIdx === 0
                  ? { color: colors.accentGold, fontWeight: '800' }
                  : { color: colors.secondaryText },
              ]}
            >
              Gateway
            </Text>
          </TouchableOpacity>

          {/* Connected Link 1-2 */}
          <View style={styles.progressConnectorLineBg}>
            <View
              style={[
                styles.progressConnectorLineFill,
                {
                  width: pageIdx >= 1 ? '100%' : '0%',
                  backgroundColor: colors.accentGold,
                },
              ]}
            />
          </View>

          {/* Node 2: Automation */}
          <TouchableOpacity
            onPress={() => goTo(1)}
            activeOpacity={0.8}
            style={styles.progressNodeWrapper}
          >
            <View
              style={[
                styles.progressNodeCircle,
                pageIdx === 1
                  ? [styles.progressNodeActive, { borderColor: colors.accentGold }]
                  : pageIdx > 1
                  ? [styles.progressNodeCompleted, { backgroundColor: colors.accentGold }]
                  : styles.progressNodeInactive,
              ]}
            >
              {pageIdx > 1 ? (
                <Ionicons name="checkmark" size={11} color="#FFFFFF" />
              ) : (
                <Text
                  style={[
                    styles.progressNodeText,
                    pageIdx === 1 && { color: colors.accentGold, fontWeight: '900' },
                  ]}
                >
                  2
                </Text>
              )}
            </View>
            <Text
              style={[
                styles.progressNodeLabel,
                pageIdx === 1
                  ? { color: colors.accentGold, fontWeight: '800' }
                  : { color: colors.secondaryText },
              ]}
            >
              Hub
            </Text>
          </TouchableOpacity>

          {/* Connected Link 2-3 */}
          <View style={styles.progressConnectorLineBg}>
            <View
              style={[
                styles.progressConnectorLineFill,
                {
                  width: pageIdx >= 2 ? '100%' : '0%',
                  backgroundColor: colors.accentGold,
                },
              ]}
            />
          </View>

          {/* Node 3: Security */}
          <TouchableOpacity
            onPress={() => goTo(2)}
            activeOpacity={0.8}
            style={styles.progressNodeWrapper}
          >
            <View
              style={[
                styles.progressNodeCircle,
                pageIdx === 2
                  ? [styles.progressNodeActive, { borderColor: colors.accentGold }]
                  : styles.progressNodeInactive,
              ]}
            >
              <Text
                style={[
                  styles.progressNodeText,
                  pageIdx === 2 && { color: colors.accentGold, fontWeight: '900' },
                ]}
              >
                3
              </Text>
            </View>
            <Text
              style={[
                styles.progressNodeLabel,
                pageIdx === 2
                  ? { color: colors.accentGold, fontWeight: '800' }
                  : { color: colors.secondaryText },
              ]}
            >
              Security
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── NATIVE HORIZONTAL SWIPEABLE SLIDES CAROUSEL (JA SCREEN DIN WAYA) ── */}
        <View style={styles.carouselViewport}>
          <ScrollView
            ref={scrollViewRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            bounces={false}
            scrollEventThrottle={16}
            onMomentumScrollEnd={handleScrollEnd}
            style={{ width: slideWidth }}
            contentContainerStyle={{ width: slideWidth * 3 }}
          >
            {/* ══════════════════════════════════════════════════════════════
                 SLIDE 0: 3D GLOBE / ADMIN CUSTOM IMAGE (TALL HERO VISUAL)
                 ══════════════════════════════════════════════════════════════ */}
            <View style={[styles.slideInner, { width: slideWidth }]}>
              {/* Category Badge */}
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

              {/* TALL HERO VISUAL WITH CONNECTED ORBITAL CHIPS */}
              <View style={styles.heroCenter}>
                {/* Floating Left Orbital Chip */}
                <Animated.View style={[styles.orbitalChipLeft, floatAnimStyle]}>
                  <LinearGradient
                    colors={['rgba(255,255,255,0.95)', 'rgba(254,243,199,0.85)']}
                    style={styles.orbitalChipGrad}
                  >
                    <Ionicons name="flash" size={11} color={colors.accentGold} />
                    <Text style={[styles.orbitalChipTxt, { color: colors.primaryText }]}>
                      Sub-second VTU
                    </Text>
                  </LinearGradient>
                </Animated.View>

                {/* Floating Right Orbital Chip */}
                <Animated.View style={[styles.orbitalChipRight, floatReverseAnimStyle]}>
                  <LinearGradient
                    colors={['rgba(255,255,255,0.95)', 'rgba(254,243,199,0.85)']}
                    style={styles.orbitalChipGrad}
                  >
                    <Ionicons name="globe-outline" size={11} color={colors.accentGold} />
                    <Text style={[styles.orbitalChipTxt, { color: colors.primaryText }]}>
                      190+ Countries
                    </Text>
                  </LinearGradient>
                </Animated.View>

                {/* Hero Card Container with Tall Height */}
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

                    {/* Ambient Aura Halo behind image */}
                    <View
                      style={[
                        styles.heroAmbientHalo,
                        {
                          backgroundColor: isPearl
                            ? 'rgba(254, 243, 199, 0.75)'
                            : 'rgba(253, 230, 138, 0.75)',
                        },
                      ]}
                    />

                    {/* HERO PICTURE: TALL 3D GLOBE OR ADMIN CUSTOM PHOTO */}
                    <Image
                      source={
                        customSlideImages[0]
                          ? { uri: customSlideImages[0]! }
                          : require('../assets/images/splash_globe_3d.png')
                      }
                      style={styles.heroImageGlobe}
                      resizeMode="contain"
                    />

                    {/* 4-Directional Feathered Blur Vignettes to Melt Dark/Square Edges */}
                    <LinearGradient
                      colors={[colors.bgGradient[0], 'rgba(255,255,255,0.4)', 'transparent']}
                      style={styles.vignetteTop}
                      pointerEvents="none"
                    />
                    <LinearGradient
                      colors={['transparent', 'rgba(255,255,255,0.4)', colors.bgGradient[1]]}
                      style={styles.vignetteBottom}
                      pointerEvents="none"
                    />
                    <LinearGradient
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      colors={[colors.bgGradient[0], 'rgba(255,255,255,0.3)', 'transparent']}
                      style={styles.vignetteLeft}
                      pointerEvents="none"
                    />
                    <LinearGradient
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      colors={['transparent', 'rgba(255,255,255,0.3)', colors.bgGradient[0]]}
                      style={styles.vignetteRight}
                      pointerEvents="none"
                    />

                    {/* Corner decorative golden accents */}
                    <View style={[styles.cornerStarTopLeft, { borderColor: colors.accentGold }]} />
                    <View style={[styles.cornerStarBottomRight, { borderColor: colors.accentGold }]} />

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

              {/* REFINED TYPOGRAPHY & VALUE PROPOSITIONS */}
              <View style={styles.slideFooterArea}>
                <Text style={[styles.slideMainHeading, { color: colors.primaryText }]}>
                  Your Gateway to Seamless Payments
                </Text>
                <Text style={[styles.slideDescription, { color: colors.secondaryText }]}>
                  Instant automated delivery for data bundles, airtime topups, utility bills, and worldwide virtual card transactions.
                </Text>

                {/* 3 Refined Value Chips */}
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

                {/* Action Button */}
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

            {/* ══════════════════════════════════════════════════════════════
                 SLIDE 1: 3D PHONE HUB / ADMIN CUSTOM IMAGE (TALL HERO VISUAL)
                 ══════════════════════════════════════════════════════════════ */}
            <View style={[styles.slideInner, { width: slideWidth }]}>
              {/* Category Badge */}
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

              {/* TALL HERO VISUAL WITH CONNECTED ORBITAL CHIPS */}
              <View style={styles.heroCenter}>
                {/* Floating Left Orbital Chip */}
                <Animated.View style={[styles.orbitalChipLeft, floatAnimStyle]}>
                  <LinearGradient
                    colors={['rgba(255,255,255,0.95)', 'rgba(254,243,199,0.85)']}
                    style={styles.orbitalChipGrad}
                  >
                    <Ionicons name="wifi" size={11} color={colors.accentGold} />
                    <Text style={[styles.orbitalChipTxt, { color: colors.primaryText }]}>
                      MTN • Airtel • Glo
                    </Text>
                  </LinearGradient>
                </Animated.View>

                {/* Floating Right Orbital Chip */}
                <Animated.View style={[styles.orbitalChipRight, floatReverseAnimStyle]}>
                  <LinearGradient
                    colors={['rgba(255,255,255,0.95)', 'rgba(254,243,199,0.85)']}
                    style={styles.orbitalChipGrad}
                  >
                    <Ionicons name="bulb-outline" size={11} color={colors.accentGold} />
                    <Text style={[styles.orbitalChipTxt, { color: colors.primaryText }]}>
                      24/7 Automated
                    </Text>
                  </LinearGradient>
                </Animated.View>

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

                    {/* Ambient Aura Halo behind image */}
                    <View
                      style={[
                        styles.heroAmbientHalo,
                        {
                          backgroundColor: isPearl
                            ? 'rgba(254, 243, 199, 0.75)'
                            : 'rgba(253, 230, 138, 0.75)',
                        },
                      ]}
                    />

                    {/* HERO PICTURE: TALL 3D PHONE HUB OR ADMIN CUSTOM PHOTO */}
                    <Image
                      source={
                        customSlideImages[1]
                          ? { uri: customSlideImages[1]! }
                          : require('../assets/images/splash_hub_phone_3d.png')
                      }
                      style={styles.heroImagePhone}
                      resizeMode="contain"
                    />

                    {/* 4-Directional Feathered Blur Vignettes */}
                    <LinearGradient
                      colors={[colors.bgGradient[0], 'rgba(255,255,255,0.4)', 'transparent']}
                      style={styles.vignetteTop}
                      pointerEvents="none"
                    />
                    <LinearGradient
                      colors={['transparent', 'rgba(255,255,255,0.4)', colors.bgGradient[1]]}
                      style={styles.vignetteBottom}
                      pointerEvents="none"
                    />
                    <LinearGradient
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      colors={[colors.bgGradient[0], 'rgba(255,255,255,0.3)', 'transparent']}
                      style={styles.vignetteLeft}
                      pointerEvents="none"
                    />
                    <LinearGradient
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      colors={['transparent', 'rgba(255,255,255,0.3)', colors.bgGradient[0]]}
                      style={styles.vignetteRight}
                      pointerEvents="none"
                    />

                    {/* Corner decorative golden accents */}
                    <View style={[styles.cornerStarTopLeft, { borderColor: colors.accentGold }]} />
                    <View style={[styles.cornerStarBottomRight, { borderColor: colors.accentGold }]} />

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

              {/* REFINED TYPOGRAPHY & VALUE PROPOSITIONS */}
              <View style={styles.slideFooterArea}>
                <Text style={[styles.slideMainHeading, { color: colors.primaryText }]}>
                  Your All-in-One Digital Hub
                </Text>
                <Text style={[styles.slideDescription, { color: colors.secondaryText }]}>
                  Fast, secure, and automated transactions. Manage all your airtime, data bundles, electricity, and cable TV in one spot.
                </Text>

                {/* 4 Refined Service Tags */}
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

                {/* Action Button */}
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

            {/* ══════════════════════════════════════════════════════════════
                 SLIDE 2: 3D CARD STACK / ADMIN CUSTOM IMAGE (TALL HERO VISUAL)
                 ══════════════════════════════════════════════════════════════ */}
            <View style={[styles.slideInner, { width: slideWidth }]}>
              {/* Category Badge */}
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

              {/* TALL HERO VISUAL WITH CONNECTED ORBITAL CHIPS */}
              <View style={styles.heroCenter}>
                {/* Floating Left Orbital Chip */}
                <Animated.View style={[styles.orbitalChipLeft, floatAnimStyle]}>
                  <LinearGradient
                    colors={['rgba(255,255,255,0.95)', 'rgba(254,243,199,0.85)']}
                    style={styles.orbitalChipGrad}
                  >
                    <Ionicons name="shield-checkmark" size={11} color="#16A34A" />
                    <Text style={[styles.orbitalChipTxt, { color: colors.primaryText }]}>
                      AES-256 SSL
                    </Text>
                  </LinearGradient>
                </Animated.View>

                {/* Floating Right Orbital Chip */}
                <Animated.View style={[styles.orbitalChipRight, floatReverseAnimStyle]}>
                  <LinearGradient
                    colors={['rgba(255,255,255,0.95)', 'rgba(254,243,199,0.85)']}
                    style={styles.orbitalChipGrad}
                  >
                    <Ionicons name="card" size={11} color={colors.accentGold} />
                    <Text style={[styles.orbitalChipTxt, { color: colors.primaryText }]}>
                      Virtual USD
                    </Text>
                  </LinearGradient>
                </Animated.View>

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

                    {/* Ambient Aura Halo behind image */}
                    <View
                      style={[
                        styles.heroAmbientHalo,
                        {
                          backgroundColor: isPearl
                            ? 'rgba(254, 243, 199, 0.75)'
                            : 'rgba(253, 230, 138, 0.75)',
                        },
                      ]}
                    />

                    {/* HERO PICTURE: TALL 3D CARD STACK OR ADMIN CUSTOM PHOTO */}
                    <Image
                      source={
                        customSlideImages[2]
                          ? { uri: customSlideImages[2]! }
                          : require('../assets/images/vc_card_stack_3d_real.png')
                      }
                      style={styles.heroImageCardStack}
                      resizeMode="contain"
                    />

                    {/* 4-Directional Feathered Blur Vignettes */}
                    <LinearGradient
                      colors={[colors.bgGradient[0], 'rgba(255,255,255,0.4)', 'transparent']}
                      style={styles.vignetteTop}
                      pointerEvents="none"
                    />
                    <LinearGradient
                      colors={['transparent', 'rgba(255,255,255,0.4)', colors.bgGradient[1]]}
                      style={styles.vignetteBottom}
                      pointerEvents="none"
                    />
                    <LinearGradient
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      colors={[colors.bgGradient[0], 'rgba(255,255,255,0.3)', 'transparent']}
                      style={styles.vignetteLeft}
                      pointerEvents="none"
                    />
                    <LinearGradient
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      colors={['transparent', 'rgba(255,255,255,0.3)', colors.bgGradient[0]]}
                      style={styles.vignetteRight}
                      pointerEvents="none"
                    />

                    {/* Corner decorative golden accents */}
                    <View style={[styles.cornerStarTopLeft, { borderColor: colors.accentGold }]} />
                    <View style={[styles.cornerStarBottomRight, { borderColor: colors.accentGold }]} />

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

              {/* ACTION BUTTONS & VALUE PROPOSITIONS */}
              <View style={styles.slide2ActionFooter}>
                <Text style={[styles.slideMainHeading, { color: colors.primaryText, marginBottom: 2 }]}>
                  Experience Luxury Fintech
                </Text>
                <Text style={[styles.slideDescription, { color: colors.secondaryText, marginBottom: 8 }]}>
                  Join thousands enjoying seamless transactions nationwide with institutional security.
                </Text>

                {/* 3 Value Proposition Cards */}
                <View style={styles.valuePropsRow}>
                  <View style={styles.valueCard}>
                    <Ionicons name="shield-checkmark" size={17} color={colors.accentGold} />
                    <Text style={[styles.valueCardTitle, { color: colors.primaryText }]}>
                      Secure
                    </Text>
                  </View>
                  <View style={styles.valueCard}>
                    <Ionicons name="globe-outline" size={17} color={colors.accentGold} />
                    <Text style={[styles.valueCardTitle, { color: colors.primaryText }]}>
                      Global
                    </Text>
                  </View>
                  <View style={styles.valueCard}>
                    <Ionicons name="flash" size={17} color={colors.accentGold} />
                    <Text style={[styles.valueCardTitle, { color: colors.primaryText }]}>
                      Instant
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
                      <Ionicons name="arrow-forward" size={17} color={colors.primaryBtnText} />
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
          </ScrollView>
        </View>

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
    width: 240,
    height: 240,
    borderRadius: 120,
    opacity: 0.45,
  },
  ambientOrbBottom: {
    position: 'absolute',
    bottom: -40,
    left: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.5,
  },
  constellationRing: {
    position: 'absolute',
    top: '32%',
    alignSelf: 'center',
    width: 380,
    height: 380,
    borderRadius: 190,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.08)',
    borderStyle: 'dashed',
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 440,
    paddingHorizontal: 16,
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
    height: 36,
    zIndex: 20,
  },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
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
    width: 34,
    height: 34,
  },
  resumeSessionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
  },
  resumeSessionTxt: {
    fontSize: 11.5,
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
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  themeToggleTxt: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  skipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  skipTxt: {
    fontSize: 12,
    fontWeight: '700',
  },

  // ── Compact Luxury Brand Header (Frees vertical space for tall hero visual) ──
  brandHeader: {
    alignItems: 'center',
    marginTop: 0,
    marginBottom: 2,
  },
  logoHaloGlow: {
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
    marginBottom: 3,
  },
  logoOuterHalo: {
    width: 66,
    height: 66,
    borderRadius: 33,
    padding: 2.5,
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: 'rgba(217, 119, 6, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoRingWrapper: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FEF3C7',
  },
  realBrandLogo: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  brandStarIcon: {
    fontSize: 10,
    fontWeight: '900',
  },
  brandTitle: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
    gap: 5,
  },
  subLine: {
    width: 18,
    height: 1.2,
    borderRadius: 1,
  },
  subDiamond: {
    fontSize: 7.5,
  },
  subText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 3.5,
  },

  // ── Connected Constellation Progress Timeline ──
  interconnectedProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 20,
    marginVertical: 4,
  },
  progressNodeWrapper: {
    alignItems: 'center',
    gap: 2,
  },
  progressNodeCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressNodeActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  progressNodeCompleted: {
    borderColor: 'transparent',
  },
  progressNodeInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderColor: '#E2E8F0',
  },
  progressNodeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  progressNodeLabel: {
    fontSize: 9.5,
    fontWeight: '600',
  },
  progressConnectorLineBg: {
    flex: 1,
    height: 2,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 8,
    marginBottom: 12,
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressConnectorLineFill: {
    height: '100%',
    borderRadius: 1,
  },

  // ── Carousel Viewport (Native Horizontal Scroll) ──
  carouselViewport: {
    flex: 1,
    width: '100%',
  },
  slideInner: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
  },

  // ── Feature Badge ──
  featureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 2,
    marginBottom: 4,
  },
  featureBadgeTxt: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },

  // ── TALL HERO VISUAL CONTAINER (KARA GIRMAN HOTON A TSAYE) ──
  heroCenter: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 4,
  },
  heroCardHolder: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  heroGlassContainer: {
    width: '92%',
    maxWidth: 345,
    height: 310, // Substantially taller vertically!
    borderRadius: 30,
    borderWidth: 1.5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 22,
    elevation: 7,
    position: 'relative',
    paddingVertical: 10,
  },
  heroAmbientHalo: {
    position: 'absolute',
    width: 250,
    height: 220,
    borderRadius: 110,
    opacity: 0.55,
    zIndex: 1,
  },

  // Floating Connected Orbital Badges
  orbitalChipLeft: {
    position: 'absolute',
    left: 4,
    top: 24,
    zIndex: 20,
  },
  orbitalChipRight: {
    position: 'absolute',
    right: 4,
    bottom: 30,
    zIndex: 20,
  },
  orbitalChipGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 4,
  },
  orbitalChipTxt: {
    fontSize: 10,
    fontWeight: '800',
  },

  // 4-Directional Feathered Blur Linear Overlays
  vignetteTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 48,
    zIndex: 6,
  },
  vignetteBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 56,
    zIndex: 6,
  },
  vignetteLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 36,
    zIndex: 6,
  },
  vignetteRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 36,
    zIndex: 6,
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

  // ── TALL HERO PICTURE SIZES ──
  heroImageGlobe: {
    width: 285,
    height: 255, // Substantially taller
    zIndex: 2,
  },
  heroImagePhone: {
    width: 280,
    height: 255, // Substantially taller
    zIndex: 2,
  },
  heroImageCardStack: {
    width: 295,
    height: 240, // Substantially taller
    zIndex: 2,
  },

  cardStatusTicker: {
    position: 'absolute',
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
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

  // ── Refined Slide Typography & Action Buttons ──
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
    fontSize: 18,
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
    paddingHorizontal: 10,
    marginBottom: 8,
  },

  // ── Slide 0 Feature Chips ──
  featureChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
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
    paddingHorizontal: 6,
  },
  serviceTag: {
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
    gap: 6,
    marginBottom: 8,
  },
  valueCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 14,
    paddingVertical: 7,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  primaryGetStartedTxt: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  secondaryAccountBtn: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 25,
    borderWidth: 1,
  },
  secondaryAccountTxt: {
    fontSize: 12.5,
    fontWeight: '700',
  },

  // ── Interactive Pagination Capsules ──
  paginationArea: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 2,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dotTouchTarget: {
    padding: 4,
  },
  dotActiveCapsule: {
    width: 24,
    height: 7,
    borderRadius: 3.5,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  dotInactive: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
});
