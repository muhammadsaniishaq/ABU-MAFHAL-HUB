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

// 4 Elite Luxury Themes: Pearl, Champagne, Sapphire, Emerald
export type LuxuryTheme = 'pearl' | 'champagne' | 'sapphire' | 'emerald';

export default function SplashScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // 0: Global Fintech Gateway, 1: All-in-One Digital Hub, 2: Institutional Value & Get Started
  const [pageIdx, setPageIdx] = useState(0);
  const [slideDirection, setSlideDirection] = useState<'forward' | 'backward'>('forward');
  // Default to Midnight Sapphire Dark Luxury (eliminates blinding white page glare)
  const [theme, setTheme] = useState<LuxuryTheme>('sapphire');
  const [hasValidSession, setHasValidSession] = useState(false);
  const [customSlideImages, setCustomSlideImages] = useState<(string | null)[]>([null, null, null]);
  const [adminLogoUrl, setAdminLogoUrl] = useState<string | null>(null);

  // Gesture tracking refs for instant, feather-light swipe response
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isSwiping = useRef(false);

  // Reanimated motions for fluid luxury levitation and instant slide change
  const floatY = useSharedValue(0);
  const floatYReverse = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  // Slide transition values
  const slideTranslateX = useSharedValue(0);
  const slideOpacity = useSharedValue(1);
  const slideScale = useSharedValue(1);

  useEffect(() => {
    // 60fps smooth floating levitation
    floatY.value = withRepeat(
      withSequence(
        withTiming(-9, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2500, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    floatYReverse.value = withRepeat(
      withSequence(
        withTiming(7, { duration: 2700, easing: Easing.inOut(Easing.sin) }),
        withTiming(-4, { duration: 2700, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
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

  // INSTANT, CRISP SLIDE ENTRANCE ANIMATION (ZERO LAG, BUTTERY SMOOTH)
  useEffect(() => {
    const initialOffset = slideDirection === 'forward' ? 38 : -38;
    slideOpacity.value = 0.25;
    slideTranslateX.value = initialOffset;
    slideScale.value = 0.96;

    slideOpacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
    slideTranslateX.value = withSpring(0, { damping: 18, stiffness: 180 });
    slideScale.value = withSpring(1, { damping: 18, stiffness: 180 });
  }, [pageIdx, slideDirection]);

  const floatAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  const floatReverseAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatYReverse.value }],
  }));

  const pulseAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const slideTransitionStyle = useAnimatedStyle(() => ({
    opacity: slideOpacity.value,
    transform: [
      { translateX: slideTranslateX.value },
      { scale: slideScale.value },
    ],
  }));

  const loadSavedTheme = async () => {
    try {
      const saved = await AsyncStorage.getItem('app_splash_luxury_theme');
      if (saved && ['sapphire', 'emerald', 'champagne', 'pearl'].includes(saved)) {
        // If previously saved as pearl, upgrade to dark sapphire as requested
        if (saved === 'pearl') {
          setTheme('sapphire');
        } else {
          setTheme(saved as LuxuryTheme);
        }
      } else {
        setTheme('sapphire');
      }
    } catch (e) {
      console.log('Theme load notice:', e);
    }
  };

  const toggleTheme = async () => {
    haptic();
    const themeCycle: LuxuryTheme[] = ['sapphire', 'emerald', 'champagne', 'pearl'];
    const currentIdx = themeCycle.indexOf(theme);
    const nextTheme = themeCycle[(currentIdx + 1) % themeCycle.length];
    setTheme(nextTheme);
    try {
      await AsyncStorage.setItem('app_splash_luxury_theme', nextTheme);
    } catch (e) {
      console.log('Theme save notice:', e);
    }
  };

  const isValidSlideUrl = (url: any): string | null => {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim();
    if (trimmed.length === 0) return null;
    if (trimmed.startsWith('blob:')) return null; // Discard temporary local browser blobs
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:image/')) {
      return trimmed;
    }
    return null;
  };

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
      isValidSlideUrl(s0),
      isValidSlideUrl(s1),
      isValidSlideUrl(s2),
    ];
  };

  const loadAdminConfig = async () => {
    try {
      const cached = await AsyncStorage.getItem('cached_splash_slides_v3');
      if (cached) {
        const cachedUrls = extractSlideUrls(cached);
        setCustomSlideImages(cachedUrls);
      }

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
      // 1. Web Browser visitor handling:
      // If accessed via a browser (web), visitors should be served the landing page,
      // not the mobile onboarding carousel splash.
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

        // If on web root and not already logged in, redirect to landing showcase
        const hasActive = await AsyncStorage.getItem('has_active_session');
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user || hasActive === 'true') {
          router.replace('/dashboard' as any);
          return;
        } else {
          // Serve web landing page
          window.location.replace('/landing.html');
          return;
        }
      }

      // 2. Mobile Native App handling (Play Store app):
      let { data: { session } } = await supabase.auth.getSession();
      const hasActive = await AsyncStorage.getItem('has_active_session');
      const savedUser = await AsyncStorage.getItem('saved_user_identifier');

      if (session?.user || hasActive === 'true' || savedUser) {
        // User is already logged in! Immediately direct them to PIN screen without showing splash slides
        await AsyncStorage.setItem('has_active_session', 'true');
        // Keep locked state so PIN is required
        await AsyncStorage.removeItem('app_unlocked');
        setHasValidSession(true);
        router.replace('/(auth)/pin' as any);
        return;
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

  // INSTANT FLUID NAVIGATION CONTROLS
  const goTo = (idx: number) => {
    if (idx === pageIdx || idx < 0 || idx > 2) return;
    haptic();
    setSlideDirection(idx > pageIdx ? 'forward' : 'backward');
    setPageIdx(idx);
  };

  const nextSlide = () => {
    if (pageIdx < 2) {
      haptic();
      setSlideDirection('forward');
      setPageIdx(p => p + 1);
    } else {
      haptic();
      router.push('/(auth)/signup' as any);
    }
  };

  const prevSlide = () => {
    if (pageIdx > 0) {
      haptic();
      setSlideDirection('backward');
      setPageIdx(p => p - 1);
    }
  };

  const skipAll = () => {
    goTo(2);
  };

  // HIGH-PERFORMANCE TOUCH SWIPE HANDLERS (IDAN AN JA GEFE)
  const onTouchStartCapture = (e: any) => {
    const pageX = e.nativeEvent?.pageX ?? e.nativeEvent?.clientX ?? 0;
    const pageY = e.nativeEvent?.pageY ?? e.nativeEvent?.clientY ?? 0;
    touchStartX.current = pageX;
    touchStartY.current = pageY;
    isSwiping.current = true;
  };

  const onTouchMoveCapture = (e: any) => {
    if (!isSwiping.current) return;
    const pageX = e.nativeEvent?.pageX ?? e.nativeEvent?.clientX ?? 0;
    const pageY = e.nativeEvent?.pageY ?? e.nativeEvent?.clientY ?? 0;
    const dx = pageX - touchStartX.current;
    const dy = pageY - touchStartY.current;

    if (Math.abs(dx) > Math.abs(dy)) {
      slideTranslateX.value = dx * 0.35;
    }
  };

  const onTouchEndCapture = (e: any) => {
    if (!isSwiping.current) return;
    isSwiping.current = false;
    const pageX = e.nativeEvent?.pageX ?? e.nativeEvent?.clientX ?? 0;
    const pageY = e.nativeEvent?.pageY ?? e.nativeEvent?.clientY ?? 0;
    const dx = pageX - touchStartX.current;
    const dy = pageY - touchStartY.current;

    // Responsive swipe threshold (32px)
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 32) {
      if (dx < 0 && pageIdx < 2) {
        nextSlide();
      } else if (dx > 0 && pageIdx > 0) {
        prevSlide();
      } else {
        slideTranslateX.value = withSpring(0, { damping: 18, stiffness: 200 });
      }
    } else {
      slideTranslateX.value = withSpring(0, { damping: 18, stiffness: 200 });
    }
  };

  // ── 4 ELITE LUXURY THEME PALETTES ──
  const getThemePalette = () => {
    switch (theme) {
      case 'champagne':
        return {
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
          haloBg: 'rgba(253, 230, 138, 0.75)',
          themeSwitchLabel: 'Champagne',
          themeSwitchIcon: 'color-palette-outline' as const,
          isDark: false,
        };

      case 'sapphire':
        return {
          bgGradient: ['#070D1E', '#0B1736', '#030712'] as const,
          primaryText: '#FFFFFF',
          secondaryText: '#94A3B8',
          accentGold: '#38BDF8',
          accentGoldDark: '#0284C7',
          cardBg: 'rgba(11, 23, 54, 0.85)',
          cardBorder: 'rgba(56, 189, 248, 0.35)',
          cardShadow: '#0284C7',
          navBtnBg: 'rgba(15, 27, 60, 0.9)',
          navBtnBorder: '#1E293B',
          badgeBg: 'rgba(56, 189, 248, 0.15)',
          badgeBorder: 'rgba(56, 189, 248, 0.4)',
          badgeText: '#38BDF8',
          primaryBtnBg: ['#0284C7', '#0369A1'] as const,
          primaryBtnText: '#FFFFFF',
          secondaryBtnBg: 'rgba(15, 23, 42, 0.85)',
          secondaryBtnBorder: '#334155',
          secondaryBtnText: '#E2E8F0',
          dotInactive: '#1E293B',
          dotActive: '#38BDF8',
          haloBg: 'rgba(56, 189, 248, 0.3)',
          themeSwitchLabel: 'Sapphire',
          themeSwitchIcon: 'moon-outline' as const,
          isDark: true,
        };

      case 'emerald':
        return {
          bgGradient: ['#04140E', '#08251B', '#020B08'] as const,
          primaryText: '#FFFFFF',
          secondaryText: '#A7F3D0',
          accentGold: '#F59E0B',
          accentGoldDark: '#D97706',
          cardBg: 'rgba(6, 30, 22, 0.85)',
          cardBorder: 'rgba(245, 158, 11, 0.35)',
          cardShadow: '#D97706',
          navBtnBg: 'rgba(8, 37, 27, 0.9)',
          navBtnBorder: '#064E3B',
          badgeBg: 'rgba(245, 158, 11, 0.15)',
          badgeBorder: 'rgba(245, 158, 11, 0.4)',
          badgeText: '#FBBF24',
          primaryBtnBg: ['#F59E0B', '#D97706'] as const,
          primaryBtnText: '#0F172A',
          secondaryBtnBg: 'rgba(6, 30, 22, 0.88)',
          secondaryBtnBorder: 'rgba(245, 158, 11, 0.3)',
          secondaryBtnText: '#FDE68A',
          dotInactive: '#064E3B',
          dotActive: '#F59E0B',
          haloBg: 'rgba(245, 158, 11, 0.35)',
          themeSwitchLabel: 'Emerald',
          themeSwitchIcon: 'diamond-outline' as const,
          isDark: true,
        };

      case 'pearl':
      default:
        return {
          bgGradient: ['#FFFFFF', '#FDFBF7', '#F5EFE6'] as const,
          primaryText: '#0D1B3E',
          secondaryText: '#64748B',
          accentGold: '#D97706',
          accentGoldDark: '#B45309',
          cardBg: 'rgba(255, 255, 255, 0.90)',
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
          haloBg: 'rgba(254, 243, 199, 0.75)',
          themeSwitchLabel: 'Pearl',
          themeSwitchIcon: 'sparkles-outline' as const,
          isDark: false,
        };
    }
  };

  const colors = getThemePalette();

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.screenBg}>
      <StatusBar barStyle={colors.isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      {/* Ambient background glowing orbs */}
      <View style={styles.bgDecorationsHolder} pointerEvents="none">
        <View style={[styles.ambientOrbTop, { backgroundColor: colors.haloBg }]} />
        <View style={[styles.ambientOrbBottom, { backgroundColor: colors.haloBg }]} />
        <View style={[styles.constellationRing, { borderColor: colors.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(217, 119, 6, 0.08)' }]} />
      </View>

      <View
        style={[
          styles.container,
          {
            paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 44 : 24) + 2,
            paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 34 : 20) + 4,
          },
        ]}
        onTouchStart={onTouchStartCapture}
        onTouchMove={onTouchMoveCapture}
        onTouchEnd={onTouchEndCapture}
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

          {/* Right Action Group: Multi-Theme Switcher & Skip Button */}
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

        {/* ── LUXURY BRAND CREST (LARGE & BEAUTIFUL AS REQUESTED) ── */}
        <View style={styles.brandHeader}>
          <Animated.View style={[styles.logoHaloGlow, pulseAnimStyle]}>
            <View style={[styles.logoOuterHalo, { borderColor: colors.accentGold }]}>
              <View style={[styles.logoRingWrapper, { backgroundColor: colors.isDark ? '#0F172A' : '#FFFFFF' }]}>
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

          {/* ── FUTURISTIC DECORATION FEATURE: LIVE RADAR SETTLEMENT TICKER ── */}
          <View style={[styles.radarTickerBar, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <View style={styles.liveGreenBeacon} />
            <Text style={[styles.radarTickerText, { color: colors.primaryText }]}>
              ⚡ Instant 0.1s VTU • ₦ NGN ⇄ $ USD • 99.9% Uptime
            </Text>
          </View>
        </View>

        {/* ── LIGHTWEIGHT, ZERO-LAG SLIDE VIEWPORT (INSTANT TRANSITIONS & 100% FLUID SWIPE) ── */}
        <Animated.View style={[styles.slideViewport, slideTransitionStyle]}>
          {/* ══════════════════════════════════════════════════════════════
               SLIDE 0: 3D GLOBE / ADMIN CUSTOM IMAGE (TALL HERO VISUAL)
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

              {/* TALL HERO VISUAL WITH CONNECTED ORBITAL CHIPS */}
              <View style={styles.heroCenter}>
                {/* Floating Left Orbital Chip */}
                <Animated.View style={[styles.orbitalChipLeft, floatAnimStyle]}>
                  <LinearGradient
                    colors={colors.isDark ? ['rgba(15,23,42,0.95)', 'rgba(30,41,59,0.9)'] : ['rgba(255,255,255,0.95)', 'rgba(254,243,199,0.85)']}
                    style={[styles.orbitalChipGrad, { borderColor: colors.cardBorder }]}
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
                    colors={colors.isDark ? ['rgba(15,23,42,0.95)', 'rgba(30,41,59,0.9)'] : ['rgba(255,255,255,0.95)', 'rgba(254,243,199,0.85)']}
                    style={[styles.orbitalChipGrad, { borderColor: colors.cardBorder }]}
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
                    {/* 1. Blurred Ambient Image Backdrop (Diffuses exact photo colors into background) */}
                    <Image
                      source={
                        customSlideImages[0]
                          ? { uri: customSlideImages[0]! }
                          : require('../assets/images/splash_globe_3d.png')
                      }
                      style={styles.blurredBackdropAura}
                      blurRadius={Platform.OS === 'ios' ? 25 : 18}
                      resizeMode="cover"
                    />

                    {Platform.OS !== 'web' ? (
                      <BlurView intensity={50} tint={colors.isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                    ) : null}

                    {/* 2. Soft Ambient Tint matching active theme */}
                    <LinearGradient
                      colors={
                        colors.isDark
                          ? ['rgba(7, 13, 30, 0.72)', 'rgba(11, 23, 54, 0.45)', 'rgba(7, 13, 30, 0.72)']
                          : ['rgba(255, 255, 255, 0.75)', 'rgba(254, 243, 199, 0.4)', 'rgba(255, 255, 255, 0.75)']
                      }
                      style={StyleSheet.absoluteFill}
                    />

                    {/* Ambient Aura Halo behind image */}
                    <View
                      style={[
                        styles.heroAmbientHalo,
                        { backgroundColor: colors.haloBg },
                      ]}
                    />

                    {/* 3. CENTER HERO PICTURE & SEAMLESS 4-WAY EDGE MELTING (ZERO SHARP BORDERS) */}
                    <View style={styles.heroImageCenterHolder}>
                      <Image
                        source={
                          customSlideImages[0]
                            ? { uri: customSlideImages[0]! }
                            : require('../assets/images/splash_globe_3d.png')
                        }
                        style={styles.heroImageGlobe}
                        resizeMode="contain"
                      />

                      {/* Seamless 4-Directional Vignette Fades strictly at image perimeter */}
                      <LinearGradient
                        colors={[colors.cardBg + 'B3', 'transparent']}
                        style={styles.vignetteTop}
                        pointerEvents="none"
                      />
                      <LinearGradient
                        colors={['transparent', colors.cardBg + 'B3']}
                        style={styles.vignetteBottom}
                        pointerEvents="none"
                      />
                      <LinearGradient
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        colors={[colors.cardBg + '99', 'transparent']}
                        style={styles.vignetteLeft}
                        pointerEvents="none"
                      />
                      <LinearGradient
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        colors={['transparent', colors.cardBg + '99']}
                        style={styles.vignetteRight}
                        pointerEvents="none"
                      />
                    </View>

                    {/* Corner decorative golden accents */}
                    <View style={[styles.cornerStarTopLeft, { borderColor: colors.accentGold }]} />
                    <View style={[styles.cornerStarBottomRight, { borderColor: colors.accentGold }]} />

                    {/* Bottom Ticker Pill Inside Card */}
                    <View style={[styles.cardStatusTicker, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
                      <View style={styles.greenPulseDot} />
                      <Text style={[styles.cardStatusTickerTxt, { color: colors.primaryText }]}>
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
                  <View style={[styles.chipItem, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
                    <Ionicons name="flash" size={12} color={colors.accentGold} />
                    <Text style={[styles.chipTxt, { color: colors.primaryText }]}>Sub-second VTU</Text>
                  </View>
                  <View style={[styles.chipItem, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
                    <Ionicons name="card" size={12} color={colors.accentGold} />
                    <Text style={[styles.chipTxt, { color: colors.primaryText }]}>Virtual USD</Text>
                  </View>
                  <View style={[styles.chipItem, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
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
          )}

          {/* ══════════════════════════════════════════════════════════════
               SLIDE 1: 3D PHONE HUB / ADMIN CUSTOM IMAGE (TALL HERO VISUAL)
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

              <View style={styles.heroCenter}>
                {/* Floating Left Orbital Chip */}
                <Animated.View style={[styles.orbitalChipLeft, floatAnimStyle]}>
                  <LinearGradient
                    colors={colors.isDark ? ['rgba(15,23,42,0.95)', 'rgba(30,41,59,0.9)'] : ['rgba(255,255,255,0.95)', 'rgba(254,243,199,0.85)']}
                    style={[styles.orbitalChipGrad, { borderColor: colors.cardBorder }]}
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
                    colors={colors.isDark ? ['rgba(15,23,42,0.95)', 'rgba(30,41,59,0.9)'] : ['rgba(255,255,255,0.95)', 'rgba(254,243,199,0.85)']}
                    style={[styles.orbitalChipGrad, { borderColor: colors.cardBorder }]}
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
                    {/* 1. Blurred Ambient Image Backdrop (Diffuses exact photo colors into background) */}
                    <Image
                      source={
                        customSlideImages[1]
                          ? { uri: customSlideImages[1]! }
                          : require('../assets/images/splash_hub_phone_3d.png')
                      }
                      style={styles.blurredBackdropAura}
                      blurRadius={Platform.OS === 'ios' ? 25 : 18}
                      resizeMode="cover"
                    />

                    {Platform.OS !== 'web' ? (
                      <BlurView intensity={50} tint={colors.isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                    ) : null}

                    {/* 2. Soft Ambient Tint matching active theme */}
                    <LinearGradient
                      colors={
                        colors.isDark
                          ? ['rgba(7, 13, 30, 0.72)', 'rgba(11, 23, 54, 0.45)', 'rgba(7, 13, 30, 0.72)']
                          : ['rgba(255, 255, 255, 0.75)', 'rgba(254, 243, 199, 0.4)', 'rgba(255, 255, 255, 0.75)']
                      }
                      style={StyleSheet.absoluteFill}
                    />

                    {/* Ambient Aura Halo behind image */}
                    <View
                      style={[
                        styles.heroAmbientHalo,
                        { backgroundColor: colors.haloBg },
                      ]}
                    />

                    {/* 3. CENTER HERO PICTURE & SEAMLESS 4-WAY EDGE MELTING (ZERO SHARP BORDERS) */}
                    <View style={styles.heroImageCenterHolder}>
                      <Image
                        source={
                          customSlideImages[1]
                            ? { uri: customSlideImages[1]! }
                            : require('../assets/images/splash_hub_phone_3d.png')
                        }
                        style={styles.heroImagePhone}
                        resizeMode="contain"
                      />

                      {/* Seamless 4-Directional Vignette Fades strictly at image perimeter */}
                      <LinearGradient
                        colors={[colors.cardBg + 'B3', 'transparent']}
                        style={styles.vignetteTop}
                        pointerEvents="none"
                      />
                      <LinearGradient
                        colors={['transparent', colors.cardBg + 'B3']}
                        style={styles.vignetteBottom}
                        pointerEvents="none"
                      />
                      <LinearGradient
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        colors={[colors.cardBg + '99', 'transparent']}
                        style={styles.vignetteLeft}
                        pointerEvents="none"
                      />
                      <LinearGradient
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        colors={['transparent', colors.cardBg + '99']}
                        style={styles.vignetteRight}
                        pointerEvents="none"
                      />
                    </View>

                    {/* Corner decorative golden accents */}
                    <View style={[styles.cornerStarTopLeft, { borderColor: colors.accentGold }]} />
                    <View style={[styles.cornerStarBottomRight, { borderColor: colors.accentGold }]} />

                    {/* Bottom Ticker Pill Inside Card */}
                    <View style={[styles.cardStatusTicker, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
                      <View style={styles.greenPulseDot} />
                      <Text style={[styles.cardStatusTickerTxt, { color: colors.primaryText }]}>
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
                  <View style={[styles.serviceTag, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
                    <Ionicons name="wifi" size={12} color={colors.accentGold} />
                    <Text style={[styles.serviceTagTxt, { color: colors.primaryText }]}>Data & Airtime</Text>
                  </View>
                  <View style={[styles.serviceTag, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
                    <Ionicons name="card" size={12} color={colors.accentGold} />
                    <Text style={[styles.serviceTagTxt, { color: colors.primaryText }]}>Virtual USD</Text>
                  </View>
                  <View style={[styles.serviceTag, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
                    <Ionicons name="bulb" size={12} color={colors.accentGold} />
                    <Text style={[styles.serviceTagTxt, { color: colors.primaryText }]}>Electricity</Text>
                  </View>
                  <View style={[styles.serviceTag, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
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
          )}

          {/* ══════════════════════════════════════════════════════════════
               SLIDE 2: 3D CARD STACK / ADMIN CUSTOM IMAGE (TALL HERO VISUAL)
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

              <View style={styles.heroCenter}>
                {/* Floating Left Orbital Chip */}
                <Animated.View style={[styles.orbitalChipLeft, floatAnimStyle]}>
                  <LinearGradient
                    colors={colors.isDark ? ['rgba(15,23,42,0.95)', 'rgba(30,41,59,0.9)'] : ['rgba(255,255,255,0.95)', 'rgba(254,243,199,0.85)']}
                    style={[styles.orbitalChipGrad, { borderColor: colors.cardBorder }]}
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
                    colors={colors.isDark ? ['rgba(15,23,42,0.95)', 'rgba(30,41,59,0.9)'] : ['rgba(255,255,255,0.95)', 'rgba(254,243,199,0.85)']}
                    style={[styles.orbitalChipGrad, { borderColor: colors.cardBorder }]}
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
                    {/* 1. Blurred Ambient Image Backdrop (Diffuses exact photo colors into background) */}
                    <Image
                      source={
                        customSlideImages[2]
                          ? { uri: customSlideImages[2]! }
                          : require('../assets/images/vc_card_stack_3d_real.png')
                      }
                      style={styles.blurredBackdropAura}
                      blurRadius={Platform.OS === 'ios' ? 25 : 18}
                      resizeMode="cover"
                    />

                    {Platform.OS !== 'web' ? (
                      <BlurView intensity={50} tint={colors.isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                    ) : null}

                    {/* 2. Soft Ambient Tint matching active theme */}
                    <LinearGradient
                      colors={
                        colors.isDark
                          ? ['rgba(7, 13, 30, 0.72)', 'rgba(11, 23, 54, 0.45)', 'rgba(7, 13, 30, 0.72)']
                          : ['rgba(255, 255, 255, 0.75)', 'rgba(254, 243, 199, 0.4)', 'rgba(255, 255, 255, 0.75)']
                      }
                      style={StyleSheet.absoluteFill}
                    />

                    {/* Ambient Aura Halo behind image */}
                    <View
                      style={[
                        styles.heroAmbientHalo,
                        { backgroundColor: colors.haloBg },
                      ]}
                    />

                    {/* 3. CENTER HERO PICTURE & SEAMLESS 4-WAY EDGE MELTING (ZERO SHARP BORDERS) */}
                    <View style={styles.heroImageCenterHolder}>
                      <Image
                        source={
                          customSlideImages[2]
                            ? { uri: customSlideImages[2]! }
                            : require('../assets/images/vc_card_stack_3d_real.png')
                        }
                        style={styles.heroImageCardStack}
                        resizeMode="contain"
                      />

                      {/* Seamless 4-Directional Vignette Fades strictly at image perimeter */}
                      <LinearGradient
                        colors={[colors.cardBg + 'B3', 'transparent']}
                        style={styles.vignetteTop}
                        pointerEvents="none"
                      />
                      <LinearGradient
                        colors={['transparent', colors.cardBg + 'B3']}
                        style={styles.vignetteBottom}
                        pointerEvents="none"
                      />
                      <LinearGradient
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        colors={[colors.cardBg + '99', 'transparent']}
                        style={styles.vignetteLeft}
                        pointerEvents="none"
                      />
                      <LinearGradient
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        colors={['transparent', colors.cardBg + '99']}
                        style={styles.vignetteRight}
                        pointerEvents="none"
                      />
                    </View>

                    {/* Corner decorative golden accents */}
                    <View style={[styles.cornerStarTopLeft, { borderColor: colors.accentGold }]} />
                    <View style={[styles.cornerStarBottomRight, { borderColor: colors.accentGold }]} />

                    {/* Bottom Ticker Pill Inside Card */}
                    <View style={[styles.cardStatusTicker, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
                      <Ionicons name="shield-checkmark" size={11} color="#16A34A" />
                      <Text style={[styles.cardStatusTickerTxt, { color: colors.primaryText }]}>
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
                  <View style={[styles.valueCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
                    <Ionicons name="shield-checkmark" size={17} color={colors.accentGold} />
                    <Text style={[styles.valueCardTitle, { color: colors.primaryText }]}>
                      Secure
                    </Text>
                  </View>
                  <View style={[styles.valueCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
                    <Ionicons name="globe-outline" size={17} color={colors.accentGold} />
                    <Text style={[styles.valueCardTitle, { color: colors.primaryText }]}>
                      Global
                    </Text>
                  </View>
                  <View style={[styles.valueCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
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
    width: 240,
    height: 240,
    borderRadius: 120,
    opacity: 0.4,
  },
  ambientOrbBottom: {
    position: 'absolute',
    bottom: -40,
    left: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.45,
  },
  constellationRing: {
    position: 'absolute',
    top: '30%',
    alignSelf: 'center',
    width: 380,
    height: 380,
    borderRadius: 190,
    borderWidth: 1,
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

  // ── Luxury Brand Crest (Grand, Prominent & Beautiful) ──
  brandHeader: {
    alignItems: 'center',
    marginTop: 0,
    marginBottom: 2,
  },
  logoHaloGlow: {
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 4,
  },
  logoOuterHalo: {
    width: 94,
    height: 94,
    borderRadius: 47,
    padding: 3.5,
    backgroundColor: 'rgba(254, 243, 199, 0.4)',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoRingWrapper: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(217, 119, 6, 0.3)',
  },
  realBrandLogo: {
    width: 74,
    height: 74,
    borderRadius: 37,
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
    fontSize: 19.5,
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
    width: 22,
    height: 1.5,
    borderRadius: 1,
  },
  subDiamond: {
    fontSize: 8,
  },
  subText: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 3.8,
  },

  // ── Futuristic Radar Ticker ──
  radarTickerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 3.5,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 4,
  },
  liveGreenBeacon: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  radarTickerText: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // ── Slide Viewport (Smooth, Fast & Fluid) ──
  slideViewport: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
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
    height: 310,
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

  // Blurred Ambient Backdrop Aura (Diffuses image colors into card)
  blurredBackdropAura: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.72,
    transform: [{ scale: 1.25 }],
    zIndex: 1,
    ...(Platform.OS === 'web' ? { filter: 'blur(32px)', WebkitFilter: 'blur(32px)' } as any : {}),
  },
  heroImageCenterHolder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 28,
    zIndex: 3,
    ...(Platform.OS === 'web' ? {
      maskImage: 'radial-gradient(ellipse 96% 94% at 50% 50%, black 90%, transparent 100%)',
      WebkitMaskImage: 'radial-gradient(ellipse 96% 94% at 50% 50%, black 90%, transparent 100%)',
    } as any : {}),
  },

  // 4-Directional Feathered Blur Linear Overlays (strictly at perimeter border)
  vignetteTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 20,
    zIndex: 6,
  },
  vignetteBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 22,
    zIndex: 6,
  },
  vignetteLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 16,
    zIndex: 6,
  },
  vignetteRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 16,
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
    height: 255,
    zIndex: 2,
  },
  heroImagePhone: {
    width: 280,
    height: 255,
    zIndex: 2,
  },
  heroImageCardStack: {
    width: 295,
    height: 240,
    zIndex: 2,
  },

  cardStatusTicker: {
    position: 'absolute',
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
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
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
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
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
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
    borderRadius: 14,
    paddingVertical: 7,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderWidth: 1,
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
