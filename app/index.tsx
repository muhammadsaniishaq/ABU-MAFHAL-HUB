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
    title: 'Register Online',
    desc: 'Buy cheap 5G data bundles, airtime, and pay utility bills at wholesale rates with instant automated delivery.',
  },
  {
    image: require('../assets/images/splash_hero_character2.gif'),
    title: 'Get Started',
    desc: 'Dedicated Moniepoint & Wema bank virtual accounts for zero-fee, instant automated wallet funding.',
  },
  {
    image: require('../assets/images/splash_hero_character3.gif'),
    title: 'Sit Back & Relax',
    desc: 'Enjoy 99.9% automated telecom services, 24/7 customer support, and lucrative wholesale reseller profits.',
  },
];

export default function SplashScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [pageIdx, setPageIdx] = useState(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  // Character Gentle Floating Animation (Slow & Steady, No Fast Rush)
  const floatY = useSharedValue(0);

  // Slide Transition Animation Shared Values
  const slideOpacity = useSharedValue(1);
  const slideScale = useSharedValue(1);

  useEffect(() => {
    checkAuthSession();

    // Gentle, smooth floating (4 seconds cycle, slow & elegant)
    floatY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true
    );
  }, []);

  // Smooth slide change animation
  useEffect(() => {
    slideOpacity.value = 0.3;
    slideScale.value = 0.94;
    slideOpacity.value = withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) });
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
          paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 44 : 24) + 12,
          paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 34 : 20) + 16,
        },
      ]}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* TOP NAVIGATION: BACK ON LEFT, SKIP ON RIGHT */}
      <View style={styles.topNav}>
        {pageIdx > 0 ? (
          <TouchableOpacity onPress={prevSlide} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-back" size={24} color="#334155" />
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtnPlaceholder} />
        )}

        {pageIdx < 2 ? (
          <TouchableOpacity onPress={skipAll} style={styles.skipBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.skipTxt}>Skip</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtnPlaceholder} />
        )}
      </View>

      {/* CENTERPIECE: CLEAN CHARACTER ILLUSTRATION & SUBTLE SHADE (NO DIS-DIS NOISE) */}
      <Animated.View style={[styles.centerArea, slideAnimStyle]}>
        <Animated.View style={[styles.mascotWrap, floatAnimStyle]}>
          {/* Soft circular background vignette behind character */}
          <View style={styles.softCircleShade} />
          <Image
            key={`slide-img-${pageIdx}`}
            source={currentSlide.image}
            style={styles.mascotImg}
            resizeMode="contain"
          />
        </Animated.View>

        {/* TYPOGRAPHY: CLEAN, MODERN, AIRY (NO CLUTTER) */}
        <View style={styles.textWrap}>
          <Text style={styles.title}>{currentSlide.title}</Text>
          <Text style={styles.desc}>{currentSlide.desc}</Text>
        </View>
      </Animated.View>

      {/* BOTTOM SECTION: 3 CLEAN PAGINATION DOTS & NEXT / CTA BUTTONS */}
      <View style={styles.bottomSection}>
        {/* 3 Pagination Dots */}
        <View style={styles.dotsRow}>
          {[0, 1, 2].map(idx => (
            <TouchableOpacity key={idx} onPress={() => goTo(idx)} hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}>
              <View style={[styles.dot, pageIdx === idx ? styles.dotActive : styles.dotInactive]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Action Button */}
        <View style={styles.actionWrap}>
          {pageIdx < 2 ? (
            <TouchableOpacity onPress={nextSlide} activeOpacity={0.85} style={styles.btnNext}>
              <Text style={styles.btnNextTxt}>Next</Text>
              <Ionicons name="chevron-forward" size={17} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: '100%', gap: 10 }}>
              <TouchableOpacity
                onPress={() => { haptic(); router.push('/(auth)/signup' as any); }}
                activeOpacity={0.88}
                style={styles.btnGetStarted}
              >
                <Text style={styles.btnGetStartedTxt}>Get Started Free</Text>
                <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => { haptic(); router.push('/(auth)/login' as any); }}
                activeOpacity={0.7}
                style={styles.btnSignIn}
              >
                <Text style={styles.btnSignInTxt}>Already have an account? Sign In</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // PURE CLEAN SEAMLESS BACKGROUND (NO DIS-DIS NOISE)
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },

  // TOP BAR
  topNav: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 40,
    zIndex: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnPlaceholder: {
    width: 40,
    height: 40,
  },
  skipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  skipTxt: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },

  // CENTER SECTION
  centerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 10,
  },
  mascotWrap: {
    width: Math.min(SW * 0.72, 280),
    height: Math.min(SH * 0.35, 280),
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 24,
  },
  softCircleShade: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#F1F5F9',
    opacity: 0.8,
  },
  mascotImg: {
    width: '100%',
    height: '100%',
  },

  // TEXT
  textWrap: {
    alignItems: 'center',
    paddingHorizontal: 16,
    maxWidth: 340,
  },
  title: {
    fontSize: 23,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 10,
  },
  desc: {
    fontSize: 13.5,
    fontWeight: '500',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },

  // BOTTOM CONTROLS
  bottomSection: {
    width: '100%',
    alignItems: 'center',
    gap: 18,
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
  actionWrap: {
    width: '100%',
  },
  btnNext: {
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
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  btnNextTxt: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  btnGetStarted: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
  btnGetStartedTxt: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  btnSignIn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  btnSignInTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
});
