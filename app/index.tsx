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

export default function SplashScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // 0: Loading / Globe, 1: Hub Phone, 2: Value Props & Get Started
  const [pageIdx, setPageIdx] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(15);
  const [customSlideImages, setCustomSlideImages] = useState<(string | null)[]>([null, null, null]);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const autoTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Reanimated smooth levitation motions
  const floatY = useSharedValue(0);
  const scaleAnim = useSharedValue(1);
  const slideOpacity = useSharedValue(1);

  useEffect(() => {
    // Gentle 60fps levitation cycle
    floatY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2400, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    checkAuthSession();
    loadCustomSplashImages();

    // Initial loading bar animation on Slide 0
    let prog = 15;
    const interval = setInterval(() => {
      prog += Math.floor(Math.random() * 18) + 12;
      if (prog >= 100) {
        prog = 100;
        setLoadingProgress(100);
        clearInterval(interval);
      } else {
        setLoadingProgress(prog);
      }
    }, 180);

    return () => {
      clearInterval(interval);
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    };
  }, []);

  // When loading bar completes on Slide 0
  useEffect(() => {
    if (loadingProgress >= 100) {
      if (hasValidSession) {
        const isPreview = Platform.OS === 'web' && typeof window !== 'undefined' && (
          window.location.search.includes('preview') || window.location.search.includes('splash')
        );
        if (!isPreview) {
          setTimeout(() => router.replace('/dashboard' as any), 350);
          return;
        }
      }

      // If user has not touched and not logged in, auto-transition to Slide 1
      if (pageIdx === 0) {
        autoTimerRef.current = setTimeout(() => {
          setPageIdx(1);
        }, 800);
      }
    }
  }, [loadingProgress, hasValidSession, pageIdx]);

  // Page index transition spring
  useEffect(() => {
    slideOpacity.value = 0.3;
    scaleAnim.value = 0.96;
    slideOpacity.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
    scaleAnim.value = withSpring(1, { damping: 15, stiffness: 120 });
  }, [pageIdx]);

  const floatAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  const slideAnimStyle = useAnimatedStyle(() => ({
    opacity: slideOpacity.value,
    transform: [{ scale: scaleAnim.value }],
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

  const goTo = (idx: number) => {
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    haptic();
    setPageIdx(idx);
  };

  const nextSlide = () => {
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    haptic();
    if (pageIdx < 2) {
      setPageIdx(p => p + 1);
    } else {
      router.push('/(auth)/signup' as any);
    }
  };

  const prevSlide = () => {
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    haptic();
    if (pageIdx > 0) {
      setPageIdx(p => p - 1);
    }
  };

  const skipAll = () => {
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
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
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 36) {
      dx < 0 ? nextSlide() : prevSlide();
    }
  };

  return (
    <LinearGradient
      colors={['#FFFFFF', '#FAF8F5', '#F5EFE6']}
      style={styles.screenBg}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

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
        {/* ── TOP NAV BAR (Back chevron & Skip button) ── */}
        <View style={styles.topNav}>
          {pageIdx > 0 ? (
            <TouchableOpacity
              onPress={prevSlide}
              style={styles.navBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={22} color="#0D1B3E" />
            </TouchableOpacity>
          ) : (
            <View style={styles.navPlaceholder} />
          )}

          {pageIdx < 2 ? (
            <TouchableOpacity
              onPress={skipAll}
              style={styles.skipBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
            >
              <Text style={styles.skipTxt}>Skip</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.navPlaceholder} />
          )}
        </View>

        {/* ── CONSTANT BRAND HEADER (AM LOGO, ABU MAFHAL, SUB, TAGLINE) ── */}
        <View style={styles.brandHeader}>
          <View style={styles.logoRingWrapper}>
            <Image
              source={require('../assets/images/am_luxury_logo.png')}
              style={styles.luxuryLogo}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.brandTitle}>ABU MAFHAL</Text>

          <View style={styles.subRow}>
            <View style={styles.subLine} />
            <Text style={styles.subText}>S U B</Text>
            <View style={styles.subLine} />
          </View>

          <Text style={styles.tagline}>Shop, Pay & Subscribe Globally</Text>
        </View>

        {/* ── SLIDE CONTENT AREA ── */}
        <Animated.View style={[styles.slideBody, slideAnimStyle]}>
          {/* ══════════════════════════════════════════════════════════════
               SCREEN 0: GLOBE WITH GOLD ORBITS & LOADING EXPERIENCE
               ══════════════════════════════════════════════════════════════ */}
          {pageIdx === 0 && (
            <View style={styles.slideInner}>
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

              <View style={styles.screen0Bottom}>
                <View style={styles.loadingTrack}>
                  <LinearGradient
                    colors={['#F59E0B', '#D97706']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.loadingFill, { width: `${loadingProgress}%` }]}
                  />
                </View>
                <Text style={styles.loadingText}>Loading Your Experience...</Text>
              </View>
            </View>
          )}

          {/* ══════════════════════════════════════════════════════════════
               SCREEN 1: 3D PHONE HUB WITH ORBITING SERVICE ICONS
               ══════════════════════════════════════════════════════════════ */}
          {pageIdx === 1 && (
            <View style={styles.slideInner}>
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

              <View style={styles.screen1Bottom}>
                {/* Gold Pagination Pill */}
                <View style={styles.paginationRow}>
                  <TouchableOpacity onPress={() => goTo(0)} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
                    <View style={styles.dotInactive} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => goTo(1)} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
                    <View style={styles.dotActiveCapsule} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => goTo(2)} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
                    <View style={styles.dotInactive} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.slideTitle}>Your All-in-One Digital Hub</Text>
                <Text style={styles.slideSubtitle}>Fast   •   Secure   •   Global</Text>

                <TouchableOpacity
                  onPress={() => goTo(2)}
                  style={styles.continuePillBtn}
                  activeOpacity={0.85}
                >
                  <Text style={styles.continuePillTxt}>Continue</Text>
                  <Ionicons name="arrow-forward" size={15} color="#D97706" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ══════════════════════════════════════════════════════════════
               SCREEN 2: VALUE PROPOSITIONS & GET STARTED ACTION
               ══════════════════════════════════════════════════════════════ */}
          {pageIdx === 2 && (
            <View style={styles.slideInner}>
              {/* Subtle World Map Watermark in background */}
              <View style={styles.worldMapHolder} pointerEvents="none">
                <Image
                  source={require('../assets/images/splash_world_map_bg.png')}
                  style={styles.worldMapImg}
                  resizeMode="contain"
                />
              </View>

              {/* 3 Value Proposition Cards */}
              <View style={styles.valuePropsContainer}>
                <View style={styles.valuePropsRow}>
                  {/* Card 1: Secure Payments */}
                  <View style={styles.valueCard}>
                    <LinearGradient
                      colors={['#FEF3C7', '#FDE68A']}
                      style={styles.valueIconBox}
                    >
                      <Ionicons name="shield-checkmark" size={21} color="#D97706" />
                    </LinearGradient>
                    <Text style={styles.valueCardTitle}>Secure{'\n'}Payments</Text>
                  </View>

                  {/* Card 2: Global Access */}
                  <View style={styles.valueCard}>
                    <LinearGradient
                      colors={['#FEF3C7', '#FDE68A']}
                      style={styles.valueIconBox}
                    >
                      <Ionicons name="globe-outline" size={21} color="#D97706" />
                    </LinearGradient>
                    <Text style={styles.valueCardTitle}>Global{'\n'}Access</Text>
                  </View>

                  {/* Card 3: Fast & Reliable */}
                  <View style={styles.valueCard}>
                    <LinearGradient
                      colors={['#FEF3C7', '#FDE68A']}
                      style={styles.valueIconBox}
                    >
                      <Ionicons name="flash" size={21} color="#D97706" />
                    </LinearGradient>
                    <Text style={styles.valueCardTitle}>Fast &{'\n'}Reliable</Text>
                  </View>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionsContainer}>
                <TouchableOpacity
                  onPress={() => {
                    haptic();
                    router.push('/(auth)/signup' as any);
                  }}
                  activeOpacity={0.88}
                  style={styles.primaryGetStartedBtn}
                >
                  <Text style={styles.primaryGetStartedTxt}>Get Started</Text>
                  <Ionicons name="arrow-forward" size={18} color="#F59E0B" style={{ marginLeft: 6 }} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    haptic();
                    router.push('/(auth)/login' as any);
                  }}
                  activeOpacity={0.8}
                  style={styles.secondaryAccountBtn}
                >
                  <Text style={styles.secondaryAccountTxt}>I Already Have an Account</Text>
                </TouchableOpacity>
              </View>

              {/* Architectural Skyline Silhouette at bottom */}
              <View style={styles.skylineHolder} pointerEvents="none">
                <Image
                  source={require('../assets/images/splash_skyline_3d.png')}
                  style={styles.skylineImg}
                  resizeMode="contain"
                />
              </View>
            </View>
          )}
        </Animated.View>
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

  // ── Top Navigation (Back & Skip) ──
  topNav: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 38,
    zIndex: 10,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navPlaceholder: {
    width: 36,
    height: 36,
  },
  skipBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  skipTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0D1B3E',
  },

  // ── Luxury Brand Header ──
  brandHeader: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  logoRingWrapper: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#FEF3C7',
    marginBottom: 10,
  },
  luxuryLogo: {
    width: 78,
    height: 78,
    borderRadius: 39,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0D1B3E',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 10,
  },
  subLine: {
    width: 34,
    height: 1.5,
    backgroundColor: '#D97706',
    borderRadius: 1,
  },
  subText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#D97706',
    letterSpacing: 4.5,
  },
  tagline: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 5,
  },

  // ── Slide Body ──
  slideBody: {
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

  // ── Hero Images Holder ──
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
    height: SH * 0.35,
    maxWidth: 300,
    maxHeight: 280,
  },
  globeImg: {
    width: Math.min(SW * 0.76, 290),
    height: Math.min(SH * 0.38, 255),
  },
  hubPhoneImg: {
    width: Math.min(SW * 0.76, 280),
    height: Math.min(SH * 0.38, 255),
  },

  // ── Screen 0: Loading bar ──
  screen0Bottom: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 28,
  },
  loadingTrack: {
    width: 175,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 12,
  },
  loadingFill: {
    height: '100%',
    borderRadius: 3,
  },
  loadingText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
  },

  // ── Screen 1: Pagination & Typography ──
  screen1Bottom: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 20,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 16,
  },
  dotTouch: {
    padding: 3,
  },
  dotInactive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#CBD5E1',
  },
  dotActiveCapsule: {
    width: 26,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D97706',
  },
  slideTitle: {
    fontSize: 20.5,
    fontWeight: '800',
    color: '#0D1B3E',
    textAlign: 'center',
    marginBottom: 6,
  },
  slideSubtitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 18,
  },
  continuePillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FEF3C7',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  continuePillTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0D1B3E',
  },

  // ── Screen 2: Value propositions & Actions ──
  worldMapHolder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    alignItems: 'center',
    opacity: 0.35,
  },
  worldMapImg: {
    width: '100%',
    height: '100%',
  },
  valuePropsContainer: {
    width: '100%',
    marginTop: 14,
    marginBottom: 20,
  },
  valuePropsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    width: '100%',
  },
  valueCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  valueIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  valueCardTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0D1B3E',
    textAlign: 'center',
    lineHeight: 14,
  },

  // ── Action Buttons ──
  actionsContainer: {
    width: '100%',
    gap: 10,
    zIndex: 10,
  },
  primaryGetStartedBtn: {
    width: '100%',
    height: 52,
    borderRadius: 26,
    backgroundColor: '#070D1E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#070D1E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 6,
  },
  primaryGetStartedTxt: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 0.3,
  },
  secondaryAccountBtn: {
    width: '100%',
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryAccountTxt: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0D1B3E',
  },

  // ── Skyline Silhouette at Bottom ──
  skylineHolder: {
    width: '100%',
    height: 90,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  skylineImg: {
    width: '100%',
    height: '100%',
  },
});
