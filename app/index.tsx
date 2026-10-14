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

const SLIDES = [
  {
    image: require('../assets/images/splash_hero_character.gif'),
    categoryText: 'OFFICIAL 5G VTU PLATFORM',
    categoryBg: '#FEF3C7',
    categoryTxt: '#B45309',
    categoryBorder: '#FDE68A',
    badgeText: '5G AUTOMATED',
    title: 'Instant 5G Data & Airtime',
    subtitle: 'Wholesale SME & Direct Telecom bundles delivered automatically in seconds.',
    chipL: { icon: '⚡', txt: '5G Automated' },
    chipR: { icon: '💰', txt: '₦240/GB SME' },
    metrics: [
      { lbl: '4 Networks', icon: '📶', bg: '#EFF6FF', txt: '#1D4ED8' },
      { lbl: 'From ₦240/GB', icon: '⚡', bg: '#FEF3C7', txt: '#B45309' },
      { lbl: '0s Instant VTU', icon: '🚀', bg: '#ECFDF5', txt: '#047857' },
    ],
    features: [
      {
        icon: '📶',
        isGold: false,
        title: 'All 4 Networks Supported',
        desc: 'MTN, Airtel, Glo & 9mobile automated wholesale recharge',
      },
      {
        icon: '💰',
        isGold: true,
        title: 'Wholesale SME Bundles',
        desc: 'Cheapest direct prices starting from ₦240 per GB with zero delay',
      },
    ],
  },
  {
    image: require('../assets/images/splash_hero_character2.gif'),
    categoryText: 'DEDICATED AUTO WALLETS',
    categoryBg: '#EFF6FF',
    categoryTxt: '#0056D2',
    categoryBorder: '#BFDBFE',
    badgeText: 'AUTO WALLETS',
    title: 'Dedicated Bank Accounts',
    subtitle: 'Automated 24/7 wallet funding with personal Nigerian bank accounts in your name.',
    chipL: { icon: '🏦', txt: 'Moniepoint / Wema' },
    chipR: { icon: '🔒', txt: '0% Deposit Fee' },
    metrics: [
      { lbl: 'Moniepoint & Wema', icon: '🏦', bg: '#EFF6FF', txt: '#0056D2' },
      { lbl: '0% Deposit Fee', icon: '🔒', bg: '#ECFDF5', txt: '#047857' },
      { lbl: '24/7 Auto-Credit', icon: '⚡', bg: '#FEF3C7', txt: '#B45309' },
    ],
    features: [
      {
        icon: '🏦',
        isGold: false,
        title: 'Personal Dedicated Accounts',
        desc: 'Moniepoint & Wema bank account numbers generated in your real name',
      },
      {
        icon: '⚡',
        isGold: true,
        title: '0-Second Instant Topup',
        desc: 'Wallet funds instantly whenever you transfer, with 0% deposit charge',
      },
    ],
  },
  {
    image: require('../assets/images/splash_hero_character3.gif'),
    categoryText: 'BILLS, RESELLER & DEV API',
    categoryBg: '#ECFDF5',
    categoryTxt: '#047857',
    categoryBorder: '#A7F3D0',
    badgeText: 'RESELLER & DEV API',
    title: 'Bills, Card Printing & API',
    subtitle: 'Automate utility bills, print recharge cards, or integrate our high-speed VTU API.',
    chipL: { icon: '💡', txt: 'Prepaid Bills' },
    chipR: { icon: '🔌', txt: 'Developer API' },
    metrics: [
      { lbl: 'NEPA Tokens', icon: '💡', bg: '#FEF3C7', txt: '#B45309' },
      { lbl: 'Card Printing', icon: '🖨️', bg: '#EFF6FF', txt: '#0056D2' },
      { lbl: 'REST VTU API', icon: '🔌', bg: '#ECFDF5', txt: '#047857' },
    ],
    features: [
      {
        icon: '💡',
        isGold: false,
        title: 'Electricity & Cable TV Cashback',
        desc: 'Instant prepaid NEPA meter tokens for AEDC, EKEDC, DStv & GOtv',
      },
      {
        icon: '🔌',
        isGold: true,
        title: 'Card Printing & Developer API',
        desc: 'Print recharge vouchers, send Bulk SMS, or connect our fast API',
      },
    ],
  },
];

export default function SplashScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [pageIdx, setPageIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  // Floating mascot animation (smooth 60fps levitation)
  const floatY = useSharedValue(0);
  const chipFloat = useSharedValue(0);

  // Transition animations
  const slideOpacity = useSharedValue(1);
  const slideScale = useSharedValue(1);

  useEffect(() => {
    checkAuthSession();

    // Gentle mascot float (3.6s cycle)
    floatY.value = withRepeat(
      withSequence(
        withTiming(-7, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true
    );

    // Floating chip micro-motion
    chipFloat.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true
    );
  }, []);

  // Story progress bar auto-advance
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
    slideOpacity.value = 0.4;
    slideScale.value = 0.96;
    slideOpacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
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
          paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 44 : 24) + 6,
          paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 34 : 20) + 12,
        },
      ]}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* TOP SECTION: STORY PROGRESS & BRAND NAVIGATION */}
      <View style={styles.topArea}>
        <View style={styles.storyBarsRow}>
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
              <Ionicons name="chevron-back" size={20} color="#0D1B3E" />
            </TouchableOpacity>
          ) : (
            <View style={styles.backPlaceholder} />
          )}

          <View style={styles.brandPill}>
            <View style={styles.brandDot} />
            <Text style={styles.brandTxt}>
              ABU <Text style={{ color: '#F5A623' }}>MAFHAL</Text> SUB
            </Text>
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

      {/* SCROLLABLE BODY */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.mainSection, slideAnimStyle]}>
          
          {/* ══════════════════════════════════════════════════════════════
               HERO STAGE — RADIANT SPOTLIGHT & MASCOT (CLEAN LUXURY)
               ══════════════════════════════════════════════════════════════ */}
          <View style={styles.heroStage}>
            {/* Ambient Halo & Ground Stage */}
            <View style={styles.ambientHalo} />
            <View style={styles.stageGroundShadow} />

            {/* Left Floating Micro Chip */}
            <Animated.View style={[styles.floatingChip, styles.floatingChipL, chipAnimStyleL]}>
              <Text style={styles.chipEmoji}>{currentSlide.chipL.icon}</Text>
              <Text style={styles.chipText}>{currentSlide.chipL.txt}</Text>
            </Animated.View>

            {/* Right Floating Micro Chip */}
            <Animated.View style={[styles.floatingChip, styles.floatingChipR, chipAnimStyleR]}>
              <Text style={styles.chipEmoji}>{currentSlide.chipR.icon}</Text>
              <Text style={styles.chipText}>{currentSlide.chipR.txt}</Text>
            </Animated.View>

            {/* Mascot Character Image */}
            <Animated.View style={[styles.mascotHolder, floatAnimStyle]}>
              <Image
                key={`slide-img-${pageIdx}`}
                source={currentSlide.image}
                style={styles.mascotImg}
                resizeMode="contain"
              />
            </Animated.View>
          </View>

          {/* HEADINGS & CATEGORY BADGE */}
          <View style={styles.headingsBox}>
            <View
              style={[
                styles.categoryBadge,
                {
                  backgroundColor: currentSlide.categoryBg,
                  borderColor: currentSlide.categoryBorder,
                },
              ]}
            >
              <Text style={[styles.categoryBadgeTxt, { color: currentSlide.categoryTxt }]}>
                ✦ {currentSlide.categoryText}
              </Text>
            </View>

            <Text style={styles.title}>{currentSlide.title}</Text>
            <Text style={styles.subtitle}>{currentSlide.subtitle}</Text>
          </View>

          {/* QUICK METRICS PILL ROW */}
          <View style={styles.metricsRow}>
            {currentSlide.metrics.map((m, idx) => (
              <View key={idx} style={[styles.metricPill, { backgroundColor: m.bg }]}>
                <Text style={styles.metricIcon}>{m.icon}</Text>
                <Text style={[styles.metricText, { color: m.txt }]}>{m.lbl}</Text>
              </View>
            ))}
          </View>

          {/* SLEEK BENEFIT CARDS */}
          <View style={styles.featuresDeck}>
            {currentSlide.features.map((feat, idx) => (
              <View key={idx} style={styles.featureCard}>
                <View style={[styles.featureIconBadge, feat.isGold && styles.featureIconBadgeGold]}>
                  <Text style={styles.featureIconTxt}>{feat.icon}</Text>
                </View>
                <View style={styles.featureBody}>
                  <Text style={styles.featurePrimaryTxt}>{feat.title}</Text>
                  <Text style={styles.featureSecondaryTxt}>{feat.desc}</Text>
                </View>
                <View style={styles.checkBadge}>
                  <Ionicons name="checkmark-sharp" size={13} color="#10B981" />
                </View>
              </View>
            ))}
          </View>

        </Animated.View>
      </ScrollView>

      {/* BOTTOM CONTROLS & ACTIONS */}
      <View style={styles.bottomArea}>
        <View style={styles.dotsRow}>
          {[0, 1, 2].map(idx => (
            <TouchableOpacity key={idx} onPress={() => goTo(idx)} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
              <View style={[styles.dot, pageIdx === idx ? styles.dotActive : styles.dotInactive]} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.actionRow}>
          {pageIdx < 2 ? (
            <TouchableOpacity onPress={nextSlide} activeOpacity={0.88} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnTxt}>Next</Text>
              <Ionicons name="chevron-forward" size={17} color="#F5A623" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: '100%', gap: 8 }}>
              <TouchableOpacity
                onPress={() => { haptic(); router.push('/(auth)/signup' as any); }}
                activeOpacity={0.88}
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryBtnTxt}>Get Started Free</Text>
                <Ionicons name="arrow-forward" size={17} color="#F5A623" />
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
  // SOLID PURE UNIFIED BACKGROUND (100% SEAMLESS WITH GIF)
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

  // TOP AREA
  topArea: {
    width: '100%',
    gap: 12,
    zIndex: 20,
  },
  storyBarsRow: {
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
    backgroundColor: '#0D1B3E',
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
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0D1B3E',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  backPlaceholder: {
    width: 36,
    height: 36,
  },
  brandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.35)',
    paddingHorizontal: 13,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
  },
  brandDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  brandTxt: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0D1B3E',
    letterSpacing: 0.3,
  },
  skipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  skipTxt: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#5A6385',
  },

  // SCROLLABLE AREA
  scrollArea: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
    paddingVertical: 4,
  },
  mainSection: {
    width: '100%',
    alignItems: 'center',
  },

  // ══════════════════════════════════════════════════════════════
  // LUXURY HERO STAGE (SPOTLIGHT & AMBIENT GLOW)
  // ══════════════════════════════════════════════════════════════
  heroStage: {
    width: '100%',
    height: Math.min(SH * 0.28, 225),
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 4,
  },
  ambientHalo: {
    position: 'absolute',
    width: Math.min(SW * 0.65, 230),
    height: Math.min(SW * 0.65, 230),
    borderRadius: Math.min(SW * 0.65, 230) / 2,
    backgroundColor: 'rgba(245, 166, 35, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.22)',
  },
  stageGroundShadow: {
    position: 'absolute',
    bottom: 4,
    width: 140,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E2E8F0',
  },
  mascotHolder: {
    width: Math.min(SW * 0.62, 225),
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  mascotImg: {
    width: '100%',
    height: '100%',
  },
  floatingChip: {
    position: 'absolute',
    zIndex: 15,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.35)',
    paddingHorizontal: 11,
    paddingVertical: 5.5,
    borderRadius: 14,
    gap: 5,
    shadowColor: '#0D1B3E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  floatingChipL: {
    left: 4,
    top: '16%',
  },
  floatingChipR: {
    right: 4,
    bottom: '18%',
  },
  chipEmoji: {
    fontSize: 12,
  },
  chipText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0D1B3E',
  },

  // HEADINGS
  headingsBox: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginBottom: 8,
    marginTop: 2,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4.5,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 6,
  },
  categoryBadgeTxt: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0D1B3E',
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#5A6385',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320,
  },

  // QUICK METRICS PILL ROW
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  metricPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  metricIcon: {
    fontSize: 11,
  },
  metricText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // VALUE BENEFIT CARDS
  featuresDeck: {
    width: '100%',
    gap: 8,
    marginBottom: 8,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: '#0D1B3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  featureIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: '#0D1B3E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  featureIconBadgeGold: {
    backgroundColor: '#D97706',
  },
  featureIconTxt: {
    fontSize: 16,
  },
  featureBody: {
    flex: 1,
  },
  featurePrimaryTxt: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0D1B3E',
    marginBottom: 1.5,
  },
  featureSecondaryTxt: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5A6385',
    lineHeight: 15,
  },
  checkBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },

  // BOTTOM CONTROLS
  bottomArea: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
    zIndex: 20,
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
    width: 24,
    backgroundColor: '#0D1B3E',
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
    backgroundColor: '#0D1B3E',
    paddingVertical: 13.5,
    borderRadius: 15,
    gap: 8,
    shadowColor: '#0056D2',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
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
    paddingVertical: 4,
  },
  secondaryBtnTxt: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#5A6385',
  },
});
