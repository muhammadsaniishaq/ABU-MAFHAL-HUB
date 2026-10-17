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

  // 0: Digital Ecosystem, 1: Virtual Cards & Powerhouse, 2: Institutional Trust & Get Started
  const [pageIdx, setPageIdx] = useState(0);
  const [slideDirection, setSlideDirection] = useState<'forward' | 'backward'>('forward');
  const [theme, setTheme] = useState<LuxuryTheme>('pearl');
  const [hasValidSession, setHasValidSession] = useState(false);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  // Reanimated motions for fluid luxury levitation and slide entrance
  const floatY = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const slideOpacity = useSharedValue(1);
  const slideTranslateX = useSharedValue(0);
  const scaleAnim = useSharedValue(1);

  useEffect(() => {
    // 60fps subtle luxury floating levitation
    floatY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2400, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    // Gentle pulse aura for decorative elements
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    loadSavedTheme();
    checkAuthSession();
  }, []);

  // MANUAL ANIMATED SLIDE TRANSITION (ZERO AUTO-SLIDE!)
  useEffect(() => {
    const offset = slideDirection === 'forward' ? 32 : -32;
    slideOpacity.value = 0.2;
    slideTranslateX.value = offset;
    scaleAnim.value = 0.96;

    slideOpacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
    slideTranslateX.value = withSpring(0, { damping: 18, stiffness: 140 });
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
      console.log('Error loading splash theme:', e);
    }
  };

  const toggleTheme = async () => {
    haptic();
    const nextTheme: LuxuryTheme = theme === 'pearl' ? 'champagne' : 'pearl';
    setTheme(nextTheme);
    try {
      await AsyncStorage.setItem('app_splash_luxury_theme', nextTheme);
    } catch (e) {
      console.log('Error saving splash theme:', e);
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

  // MANUAL SLIDE CONTROLS (NO AUTO-SLIDE EVER!)
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

  // TOUCH GESTURE - MANUAL SWIPE SUPPORT
  const handleTouchStart = (e: any) => {
    touchStartX.current = e.nativeEvent.pageX;
    touchStartY.current = e.nativeEvent.pageY;
  };

  const handleTouchEnd = (e: any) => {
    const dx = e.nativeEvent.pageX - touchStartX.current;
    const dy = e.nativeEvent.pageY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      if (dx < 0) {
        if (pageIdx < 2) nextSlide();
      } else {
        if (pageIdx > 0) prevSlide();
      }
    }
  };

  // ── LUXURY THEME PALETTES (PURE BRIGHT, ZERO BLACK BACKGROUND) ──
  const isPearl = theme === 'pearl';
  const colors = isPearl
    ? {
        bgGradient: ['#FFFFFF', '#FDFBF7', '#F5EFE6'] as const,
        primaryText: '#0D1B3E',
        secondaryText: '#64748B',
        accentGold: '#D97706',
        accentGoldDark: '#B45309',
        cardBg: 'rgba(255, 255, 255, 0.88)',
        cardBorder: 'rgba(217, 119, 6, 0.28)',
        cardInnerBorder: 'rgba(255, 255, 255, 0.9)',
        cardShadow: '#D97706',
        navBtnBg: 'rgba(255, 255, 255, 0.95)',
        navBtnBorder: '#E2E8F0',
        badgeBg: 'rgba(217, 119, 6, 0.1)',
        badgeBorder: 'rgba(217, 119, 6, 0.28)',
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
        cardBorder: 'rgba(180, 83, 9, 0.32)',
        cardInnerBorder: 'rgba(255, 255, 255, 0.95)',
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

      {/* Decorative ambient background glows */}
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
        onTouchEnd={handleTouchEnd}
      >
        {/* ── TOP NAV BAR (Back chevron, Theme Switcher, Skip) ── */}
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

          {/* Quick Dashboard Resume Pill if Session Exists */}
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

          {/* Right Group: Theme Switcher + Skip Button */}
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

        {/* ── LUXURY BRAND HEADER WITH REAL ABU MAFHAL LOGO ── */}
        <View style={styles.brandHeader}>
          <View style={styles.logoHaloGlow}>
            <View style={styles.logoRingWrapper}>
              <Image
                source={require('../assets/images/logo.png')}
                style={styles.realBrandLogo}
                resizeMode="contain"
              />
            </View>
          </View>

          <Text style={[styles.brandTitle, { color: colors.primaryText }]}>ABU MAFHAL</Text>

          <View style={styles.subRow}>
            <View style={[styles.subLine, { backgroundColor: colors.accentGold }]} />
            <Text style={[styles.subText, { color: colors.accentGold }]}>S U B</Text>
            <View style={[styles.subLine, { backgroundColor: colors.accentGold }]} />
          </View>

          <Text style={[styles.tagline, { color: colors.secondaryText }]}>
            Shop, Pay & Subscribe Globally
          </Text>
        </View>

        {/* ── ANIMATED SLIDE BODY (NO AUTO SLIDE - USER INTERACTION ONLY) ── */}
        <Animated.View style={[styles.slideBody, slideAnimStyle]}>
          {/* ══════════════════════════════════════════════════════════════
               SLIDE 0: GLASSMORPHIC ECOSYSTEM & INSTANT SERVICES
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
                  PREMIER DIGITAL ECOSYSTEM
                </Text>
              </View>

              {/* HERO VISUAL: BLURRED BORDERED CARD WITH REAL LOGO EMBLEM & ORBITING PILLS */}
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
                      <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFill} />
                    ) : null}

                    {/* Subtle internal gold gradient sheen */}
                    <LinearGradient
                      colors={['rgba(255,255,255,0.7)', 'rgba(254,243,199,0.35)', 'rgba(255,255,255,0.6)']}
                      style={StyleSheet.absoluteFill}
                    />

                    {/* Corner decorative golden accents */}
                    <View style={[styles.cornerStarTopLeft, { borderColor: colors.accentGold }]} />
                    <View style={[styles.cornerStarBottomRight, { borderColor: colors.accentGold }]} />

                    {/* Central Medallion with Real Logo */}
                    <Animated.View style={[styles.centralLogoMedal, pulseAnimStyle]}>
                      <LinearGradient
                        colors={['#FEF3C7', '#FDE68A']}
                        style={styles.medalGlowHalo}
                      >
                        <View style={styles.medalInnerCircle}>
                          <Image
                            source={require('../assets/images/logo.png')}
                            style={styles.showcaseLogo}
                            resizeMode="contain"
                          />
                        </View>
                      </LinearGradient>
                      <View style={styles.verifiedCheckBadge}>
                        <Ionicons name="checkmark-circle" size={19} color="#16A34A" />
                      </View>
                    </Animated.View>

                    {/* 4 Floating Orbiting Service Pills */}
                    <View style={[styles.floatingServicePill, styles.orbitPillTopLeft]}>
                      <Ionicons name="flash" size={13} color="#D97706" />
                      <Text style={styles.orbitPillTxt}>Instant VTU</Text>
                    </View>

                    <View style={[styles.floatingServicePill, styles.orbitPillTopRight]}>
                      <Ionicons name="card" size={13} color="#2563EB" />
                      <Text style={styles.orbitPillTxt}>USD Cards</Text>
                    </View>

                    <View style={[styles.floatingServicePill, styles.orbitPillBottomLeft]}>
                      <Ionicons name="bulb" size={13} color="#EAB308" />
                      <Text style={styles.orbitPillTxt}>Electricity</Text>
                    </View>

                    <View style={[styles.floatingServicePill, styles.orbitPillBottomRight]}>
                      <Ionicons name="tv" size={13} color="#059669" />
                      <Text style={styles.orbitPillTxt}>Cable Sub</Text>
                    </View>

                    {/* Bottom Status Ticker inside the card */}
                    <View style={styles.cardStatusTicker}>
                      <View style={styles.greenPulseDot} />
                      <Text style={styles.cardStatusTickerTxt}>
                        99.9% Automated Processing Speed
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
               SLIDE 1: LUXURY VIRTUAL CARD & MULTI-SERVICE HUB
               ══════════════════════════════════════════════════════════════ */}
          {pageIdx === 1 && (
            <View style={styles.slideInner}>
              <View
                style={[
                  styles.featureBadge,
                  { backgroundColor: colors.badgeBg, borderColor: colors.badgeBorder },
                ]}
              >
                <Ionicons name="card-outline" size={13} color={colors.accentGold} />
                <Text style={[styles.featureBadgeTxt, { color: colors.badgeText }]}>
                  GLOBAL VIRTUAL CARDS & VTU
                </Text>
              </View>

              {/* HERO VISUAL: BLURRED BORDERED CARD WITH EMBOSSED VIRTUAL CARD */}
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
                      <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFill} />
                    ) : null}

                    <LinearGradient
                      colors={['rgba(255,255,255,0.7)', 'rgba(254,243,199,0.3)', 'rgba(255,255,255,0.6)']}
                      style={StyleSheet.absoluteFill}
                    />

                    {/* Realistic Luxury Virtual Card Showcase */}
                    <View style={styles.virtualCardShowcase}>
                      <LinearGradient
                        colors={['#0D1B3E', '#162C65', '#0A1329']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.virtualCardGrad}
                      >
                        {/* Top Card Row */}
                        <View style={styles.vcTopRow}>
                          <Image
                            source={require('../assets/images/logo.png')}
                            style={styles.vcBrandLogo}
                            resizeMode="contain"
                          />
                          <View style={styles.vcContactless}>
                            <Ionicons name="wifi" size={17} color="#F59E0B" />
                          </View>
                        </View>

                        {/* Gold EMV Chip & Number */}
                        <View style={styles.vcMidRow}>
                          <LinearGradient
                            colors={['#FDE68A', '#F59E0B', '#D97706']}
                            style={styles.vcChip}
                          />
                          <Text style={styles.vcCardNumber}>5399 •••• •••• 8820</Text>
                        </View>

                        {/* Bottom Card Row */}
                        <View style={styles.vcBottomRow}>
                          <View>
                            <Text style={styles.vcHolderLabel}>CARDHOLDER</Text>
                            <Text style={styles.vcHolderName}>ABU MAFHAL VIP</Text>
                          </View>
                          <View style={styles.vcMasterCircles}>
                            <View style={[styles.vcCircle, { backgroundColor: '#EF4444' }]} />
                            <View style={[styles.vcCircle, { backgroundColor: '#F59E0B', marginLeft: -8 }]} />
                          </View>
                        </View>
                      </LinearGradient>
                    </View>

                    {/* Floating Trust Pills */}
                    <View style={styles.vcFloatingBadgeRow}>
                      <View style={styles.vcMicroBadge}>
                        <Ionicons name="lock-closed" size={11} color="#059669" />
                        <Text style={styles.vcMicroBadgeTxt}>3D Secure PIN</Text>
                      </View>
                      <View style={styles.vcMicroBadge}>
                        <Ionicons name="globe-outline" size={11} color="#2563EB" />
                        <Text style={styles.vcMicroBadgeTxt}>USD Worldwide</Text>
                      </View>
                    </View>
                  </View>
                </Animated.View>
              </View>

              {/* Slide Content & Action Button */}
              <View style={styles.slideFooterArea}>
                <Text style={[styles.slideMainHeading, { color: colors.primaryText }]}>
                  Unlimited Global Purchasing Power
                </Text>
                <Text style={[styles.slideDescription, { color: colors.secondaryText }]}>
                  Pay on Netflix, Amazon, Apple, Google, and worldwide merchant platforms with zero decline rates and competitive exchange rates.
                </Text>

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
               SLIDE 2: INSTITUTIONAL TRUST & GET STARTED ACTION
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

              {/* HERO VISUAL: BLURRED BORDERED CARD WITH SECURITY CREST & VALUE METRICS */}
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
                      <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFill} />
                    ) : null}

                    <LinearGradient
                      colors={['rgba(255,255,255,0.7)', 'rgba(254,243,199,0.35)', 'rgba(255,255,255,0.6)']}
                      style={StyleSheet.absoluteFill}
                    />

                    {/* Central Gold Security Crest */}
                    <View style={styles.trustShieldHolder}>
                      <LinearGradient
                        colors={['#FEF3C7', '#FDE68A']}
                        style={styles.shieldGlowRing}
                      >
                        <LinearGradient
                          colors={['#0D1B3E', '#162C65']}
                          style={styles.shieldInner}
                        >
                          <Ionicons name="shield-checkmark" size={32} color="#F59E0B" />
                        </LinearGradient>
                      </LinearGradient>
                      <Text style={styles.shieldMainTitle}>Bank-Grade Security</Text>
                      <Text style={styles.shieldSubTitle}>256-bit SSL Encryption & Biometrics</Text>
                    </View>

                    {/* 3 Metric Value Capsules */}
                    <View style={styles.metricCapsulesRow}>
                      <View style={styles.metricCapsule}>
                        <Ionicons name="flash" size={14} color="#D97706" />
                        <Text style={styles.metricVal}>0.2s</Text>
                        <Text style={styles.metricLbl}>Avg Speed</Text>
                      </View>
                      <View style={styles.metricCapsule}>
                        <Ionicons name="checkmark-done" size={14} color="#16A34A" />
                        <Text style={styles.metricVal}>99.9%</Text>
                        <Text style={styles.metricLbl}>Uptime</Text>
                      </View>
                      <View style={styles.metricCapsule}>
                        <Ionicons name="headset" size={14} color="#2563EB" />
                        <Text style={styles.metricVal}>24/7</Text>
                        <Text style={styles.metricLbl}>VIP Support</Text>
                      </View>
                    </View>
                  </View>
                </Animated.View>
              </View>

              {/* Action Buttons */}
              <View style={styles.slide2ActionFooter}>
                <Text style={[styles.slideMainHeading, { color: colors.primaryText, marginBottom: 4 }]}>
                  Ready to Experience Abu Mafhal?
                </Text>
                <Text style={[styles.slideDescription, { color: colors.secondaryText, marginBottom: 12 }]}>
                  Join thousands of satisfied users enjoying seamless transactions across the nation.
                </Text>

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
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.45,
  },
  ambientOrbBottom: {
    position: 'absolute',
    bottom: -40,
    left: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
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

  // ── Luxury Brand Header With Real Logo ──
  brandHeader: {
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 4,
  },
  logoHaloGlow: {
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  logoRingWrapper: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FEF3C7',
    marginBottom: 6,
  },
  realBrandLogo: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 8,
  },
  subLine: {
    width: 28,
    height: 1.5,
    borderRadius: 1,
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
    height: Math.min(SH * 0.34, 255),
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
  },

  // ── SLIDE 0: Central Medallion & Orbit Pills ──
  centralLogoMedal: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  medalGlowHalo: {
    width: 82,
    height: 82,
    borderRadius: 41,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  medalInnerCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  showcaseLogo: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  verifiedCheckBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
  },

  // Floating Orbiting Pills
  floatingServicePill: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  orbitPillTopLeft: {
    top: 18,
    left: 14,
  },
  orbitPillTopRight: {
    top: 18,
    right: 14,
  },
  orbitPillBottomLeft: {
    bottom: 34,
    left: 14,
  },
  orbitPillBottomRight: {
    bottom: 34,
    right: 14,
  },
  orbitPillTxt: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0D1B3E',
  },
  cardStatusTicker: {
    position: 'absolute',
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  greenPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  cardStatusTickerTxt: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },

  // ── SLIDE 1: Virtual Card Showcase ──
  virtualCardShowcase: {
    width: '88%',
    height: 146,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#0D1B3E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  virtualCardGrad: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  vcTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vcBrandLogo: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  vcContactless: {
    transform: [{ rotate: '90deg' }],
  },
  vcMidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  vcChip: {
    width: 26,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  vcCardNumber: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2.2,
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  vcBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  vcHolderLabel: {
    fontSize: 7.5,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1,
  },
  vcHolderName: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 1.2,
  },
  vcMasterCircles: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vcCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    opacity: 0.9,
  },
  vcFloatingBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  vcMicroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  vcMicroBadgeTxt: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#0D1B3E',
  },

  // ── SLIDE 2: Trust Shield & Metrics ──
  trustShieldHolder: {
    alignItems: 'center',
    marginBottom: 8,
  },
  shieldGlowRing: {
    width: 66,
    height: 66,
    borderRadius: 33,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 4,
  },
  shieldInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldMainTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0D1B3E',
  },
  shieldSubTitle: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748B',
  },
  metricCapsulesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '90%',
    gap: 6,
    marginTop: 6,
  },
  metricCapsule: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    paddingVertical: 7,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  metricVal: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0D1B3E',
    marginTop: 2,
  },
  metricLbl: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#64748B',
  },

  // ── Slide Content Typography & Buttons ──
  slideFooterArea: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 6,
  },
  slide2ActionFooter: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 4,
  },
  slideMainHeading: {
    fontSize: 19,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  slideDescription: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 12,
    marginBottom: 10,
  },
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

  // ── Slide 2 Action Buttons ──
  actionsContainer: {
    width: '100%',
    gap: 8,
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
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryGetStartedTxt: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  secondaryAccountBtn: {
    width: '100%',
    height: 46,
    borderRadius: 23,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryAccountTxt: {
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Interactive Pagination Area ──
  paginationArea: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 4,
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
