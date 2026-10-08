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
  ScrollView,
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
} from 'react-native-reanimated';
import { supabase, processOAuthReturn } from '../services/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type LangKey = 'en' | 'ha';

// ─── COPY & LOCALIZATION ──────────────────────────────────────────────────────
const COPY = {
  en: {
    lang: '🇳🇬 HA',
    support: '24/7 Support',
    brand: 'ABU MAFHAL SUB',
    tagline: 'Smart Telecom & Automated Financial Services',
    
    // Slide 1: Welcome
    slide1Badge: 'OFFICIAL PLATFORM',
    slide1Title: 'Fast, Reliable &\nAutomated Telecom',
    slide1Sub: 'Buy cheap data bundles, airtime, and pay utility bills at wholesale prices with instant automated delivery.',
    pillar1Title: 'Instant 5G Data',
    pillar1Sub: 'MTN, Airtel, Glo & 9mobile delivered in seconds',
    pillar2Title: 'Dedicated Bank Accounts',
    pillar2Sub: 'Personalized Moniepoint & Wema instant wallet funding',
    pillar3Title: 'Bills & Electricity',
    pillar3Sub: 'Prepaid tokens & TV renewals with instant receipt',
    statProcessed: '₦2.5B+',
    statProcessedLbl: 'Processed',
    statUsers: '50,000+',
    statUsersLbl: 'Active Users',
    statUptime: '99.98%',
    statUptimeLbl: 'System Uptime',

    // Slide 2: Services
    slide2Badge: 'OUR SERVICES',
    slide2Title: 'Everything You Need\nIn One Simple App',
    slide2Sub: 'Wholesale telecom rates tailored for personal use and profitable reselling business.',
    srv1Title: 'Cheap Data Bundles',
    srv1Desc: 'SME, Corporate & Gifting packages starting from ₦240/GB',
    srv2Title: 'Airtime & Recharge',
    srv2Desc: 'Instant top-up across all networks with up to 3% cashback',
    srv3Title: 'Electricity & Cable TV',
    srv3Desc: 'AEDC, EKEDC, IBEDC tokens & instant DStv, GOtv activation',
    srv4Title: 'Dedicated Virtual Accounts',
    srv4Desc: 'Automated 0-fee bank accounts that fund wallet instantly',
    partnersLabel: 'SUPPORTED NETWORKS & BANKS',

    // Slide 3: Get Started
    slide3Badge: 'START IN 30 SECONDS',
    slide3Title: 'Ready to Experience\nSeamless Telecom?',
    slide3Sub: 'Join over 50,000 happy users and start saving or earning today.',
    step1Num: '01',
    step1Title: 'Create Free Account',
    step1Desc: 'Quick sign-up with just your phone number & email.',
    step2Num: '02',
    step2Title: 'Fund Your Wallet',
    step2Desc: 'Instant bank transfer to your dedicated account.',
    step3Num: '03',
    step3Title: 'Transact & Profit',
    step3Desc: 'Buy at wholesale rates or resell to earn daily income.',
    btnSignup: 'Create Free Account',
    btnSignupSub: 'Zero setup fees · Instant access',
    btnSignin: 'Sign In to Account',
    securityBadge: 'Bank-Grade 256-Bit SSL · NDPA Certified · Instant Processing',

    // Nav
    skip: 'Skip',
    next: 'Next',
    back: 'Back',
    verifying: 'Checking session...',
  },
  ha: {
    lang: '🇬🇧 EN',
    support: 'Taimako 24/7',
    brand: 'ABU MAFHAL SUB',
    tagline: 'Babban Dandalin Sayen Data da Biyan Kudi Cikin Sauki',

    // Slide 1: Welcome
    slide1Badge: 'INGANTACCEN DANDALI',
    slide1Title: 'Saurin Bayarwa &\nIngancin Aiki',
    slide1Sub: 'Sami data mai arha, katin waya, da biyan kudin wuta da TV akan farashin sari cikin sakan kadan.',
    pillar1Title: 'Data Mai Sauki',
    pillar1Sub: 'MTN, Airtel, Glo da 9mobile cikin sakan 3',
    pillar2Title: 'Asusun Banki Na Kai',
    pillar2Sub: 'Moniepoint da Wema na musamman don zuba kudi a take',
    pillar3Title: 'Wutar Lantarki & TV',
    pillar3Sub: 'Token din wuta da kunna DStv & GOtv nan take tare da shaida',
    statProcessed: '₦2.5B+',
    statProcessedLbl: 'An Sarrafa',
    statUsers: '50,000+',
    statUsersLbl: 'Masu Amfani',
    statUptime: '99.98%',
    statUptimeLbl: 'Aiki Dare da Rana',

    // Slide 2: Services
    slide2Badge: 'AYYUKANMU',
    slide2Title: 'Duk Abin Da Kake Bukata\nA Wuri Guda',
    slide2Sub: 'Farashin sari mai sauki ga amfanin kanka ko don sana\'ar samun riba mai dorewa.',
    srv1Title: 'Sayen Data Mai Sauki',
    srv1Desc: 'SME, Corporate da Gifting na dukkan layuka akan rahusa',
    srv2Title: 'Katin Waya & Bonus',
    srv2Desc: 'Cika asusu nan take tare da samun cashback na kashi 3%',
    srv3Title: 'Token din Wuta & TV',
    srv3Desc: 'Biyan wutar AEDC, EKEDC, IBEDC da kunna DStv & GOtv nan take',
    srv4Title: 'Asusun Banki Na Musamman',
    srv4Desc: 'Asusun Moniepoint da Wema wanda kudi ke shiga wallet a take',
    partnersLabel: 'LAYUKAN WAYA DA BANKUNA',

    // Slide 3: Get Started
    slide3Badge: 'FARA CIKIN SAKAN 30',
    slide3Title: 'A Shirye Kake Ka Fara\nSamun Sauki da Riba?',
    slide3Sub: 'Kasance tare da masu amfani sama da 50,000 ka fara amfana a yau.',
    step1Num: '01',
    step1Title: 'Bude Asusu Kyauta',
    step1Desc: 'Yi rajista cikin sakan 30 da lambar wayarka kawai.',
    step2Num: '02',
    step2Title: 'Zuba Kudi a Wallet',
    step2Desc: 'Tura kudi zuwa asusun bankinka na Moniepoint ko Wema.',
    step3Num: '03',
    step3Title: 'Fara Sayayya da Riba',
    step3Desc: 'Saye a farashin sari ko sayarwa don samun karin kudin shiga.',
    btnSignup: 'Bude Asusu Kyauta',
    btnSignupSub: 'Babu kudin rajista · Nan take zai bude',
    btnSignin: 'Shiga Asusunka',
    securityBadge: 'Cikakken Tsaro na Banki 256-Bit SSL · NDPA Certified',

    // Nav
    skip: 'Wuce Gaba',
    next: 'Na Gaba',
    back: 'Koma Baya',
    verifying: 'Ana duba asusu...',
  },
};

// ─── ANIMATED DOT INDICATOR ───────────────────────────────────────────────────
function DotIndicator({ active }: { active: boolean }) {
  const widthAnim = useSharedValue(active ? 24 : 8);
  const opacityAnim = useSharedValue(active ? 1 : 0.35);

  useEffect(() => {
    widthAnim.value = withSpring(active ? 24 : 8, { damping: 15, stiffness: 130 });
    opacityAnim.value = withTiming(active ? 1 : 0.35, { duration: 200 });
  }, [active]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: widthAnim.value,
    opacity: opacityAnim.value,
  }));

  return (
    <Animated.View
      style={[
        styles.dot,
        active ? styles.dotActive : styles.dotInactive,
        animatedStyle,
      ]}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SPLASH SCREEN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function SplashScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [checking, setChecking] = useState(true);
  const [lang, setLang] = useState<LangKey>('ha'); // Default to Hausa as per primary user base
  const [pageIdx, setPageIdx] = useState(0);

  // Swipe gesture tracking
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  useEffect(() => {
    checkAuthSession();
  }, []);

  const checkAuthSession = async () => {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const search = window.location.search || '',
          hash = window.location.hash || '';
        const hasAuth =
          (hash && hash.includes('access_token')) || (search && search.includes('code='));
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

      let {
        data: { session },
      } = await supabase.auth.getSession();

      // On web, Supabase may return session=null on first tick during page reload
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
        setTimeout(() => router.replace('/dashboard' as any), 500);
      } else {
        const hasActive = await AsyncStorage.getItem('has_active_session');
        if (hasActive !== 'true') {
          await AsyncStorage.removeItem('has_active_session');
          await AsyncStorage.removeItem('app_unlocked');
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            const pathname = window.location.pathname;
            if (pathname === '/' || pathname === '' || pathname === '/index.html') {
              window.location.replace('/landing.html');
              return;
            }
          }
        }
        setChecking(false);
      }
    } catch {
      setChecking(false);
    }
  };

  const haptic = useCallback(() => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
  }, []);

  const goToPage = (idx: number) => {
    haptic();
    setPageIdx(idx);
  };

  const goNext = () => {
    haptic();
    setPageIdx(p => Math.min(p + 1, 2));
  };

  const goPrev = () => {
    haptic();
    setPageIdx(p => Math.max(p - 1, 0));
  };

  const goSkip = () => {
    haptic();
    setPageIdx(2);
  };

  // Touch gesture handlers for horizontal swipe
  const handleTouchStart = (e: any) => {
    touchStartX.current = e.nativeEvent.pageX;
    touchStartY.current = e.nativeEvent.pageY;
  };

  const handleTouchEnd = (e: any) => {
    const dx = e.nativeEvent.pageX - touchStartX.current;
    const dy = e.nativeEvent.pageY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 45) {
      if (dx < 0) {
        goNext();
      } else {
        goPrev();
      }
    }
  };

  const c = COPY[lang];

  // Dynamic bottom padding: handles Android system navigation bar (3 buttons or gesture pill) & iOS home indicator
  // When Android 3-button navigation is open, insets.bottom is typically 48-56px.
  // We guarantee at least 16px extra padding above whatever system insets exist so nothing is ever obscured!
  const navBarBottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 16) + 12;

  return (
    <View style={styles.screenContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" translucent={false} />

      {/* Luminous, clean, premium background (Never dark or dull) */}
      <LinearGradient
        colors={['#FFFFFF', '#F8FAFC', '#F1F5F9']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Subtle modern soft lighting orbs (minimal & elegant, not noisy) */}
      <View style={styles.ambientTopGlow} pointerEvents="none" />
      <View style={styles.ambientBottomGlow} pointerEvents="none" />

      {/* Main Safe Container */}
      <View
        style={[
          styles.mainContentArea,
          { paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 12 : 8) },
        ]}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Top Header Bar: Language Switcher & WhatsApp Help */}
        <View style={styles.topHeaderBar}>
          <TouchableOpacity
            onPress={() => {
              haptic();
              setLang(l => (l === 'en' ? 'ha' : 'en'));
            }}
            style={styles.langPillBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="globe-outline" size={14} color="#0F172A" style={{ marginRight: 5 }} />
            <Text style={styles.langPillTxt}>{c.lang}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() =>
              Linking.openURL('https://wa.me/2348144445438?text=Hello%20Abu%20Mafhal%20Support')
            }
            style={styles.supportPillBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-whatsapp" size={14} color="#16A34A" style={{ marginRight: 5 }} />
            <Text style={styles.supportPillTxt}>{c.support}</Text>
          </TouchableOpacity>
        </View>

        {/* Scrollable Slide Content (Never clips or overflows on any device) */}
        <ScrollView
          style={styles.slideScroll}
          contentContainerStyle={styles.slideScrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {pageIdx === 0 && <SlideWelcome c={c} />}
          {pageIdx === 1 && <SlideServices c={c} />}
          {pageIdx === 2 && (
            <SlideGetStarted
              c={c}
              checking={checking}
              router={router}
              haptic={haptic}
            />
          )}
        </ScrollView>

        {/* Bottom Navigation Bar — GUARANTEED Safe Area Clearance for Android 3-Button Navigation */}
        <View style={[styles.bottomNavBar, { paddingBottom: navBarBottomPadding }]}>
          {/* Dot Pagination */}
          <View style={styles.dotsContainer}>
            {[0, 1, 2].map(i => (
              <TouchableOpacity
                key={i}
                onPress={() => goToPage(i)}
                hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
              >
                <DotIndicator active={pageIdx === i} />
              </TouchableOpacity>
            ))}
          </View>

          {/* Action Navigation Controls */}
          <View style={styles.navControlsRow}>
            {pageIdx < 2 ? (
              <>
                <TouchableOpacity onPress={goSkip} style={styles.skipBtn} activeOpacity={0.7}>
                  <Text style={styles.skipBtnTxt}>{c.skip}</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={goNext} style={styles.nextBtnWrap} activeOpacity={0.88}>
                  <LinearGradient
                    colors={['#F59E0B', '#D97706']}
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
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 1: WELCOME & BRAND OVERVIEW
// ─────────────────────────────────────────────────────────────────────────────
function SlideWelcome({ c }: { c: typeof COPY.en }) {
  return (
    <View style={styles.slideContainer}>
      {/* Brand Hero Medallion */}
      <View style={styles.logoMedallionWrap}>
        <View style={styles.logoCard}>
          <Image
            source={require('../assets/images/logo.png')}
            style={styles.logoImg}
            resizeMode="contain"
          />
        </View>
        <View style={styles.verifiedCheckBadge}>
          <Ionicons name="checkmark-sharp" size={11} color="#FFFFFF" />
        </View>
      </View>

      {/* Main Headline & Badge */}
      <View style={styles.centerTextWrap}>
        <View style={styles.badgePill}>
          <Ionicons name="sparkles" size={11} color="#D97706" style={{ marginRight: 4 }} />
          <Text style={styles.badgePillTxt}>{c.slide1Badge}</Text>
        </View>
        <Text style={styles.mainTitle}>{c.slide1Title}</Text>
        <Text style={styles.mainSubtitle}>{c.slide1Sub}</Text>
      </View>

      {/* 3 Executive Pillars (Clean, Spacious Cards) */}
      <View style={styles.pillarsContainer}>
        <View style={styles.pillarCard}>
          <View style={[styles.pillarIconWrap, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="wifi" size={18} color="#2563EB" />
          </View>
          <View style={styles.pillarTextWrap}>
            <Text style={styles.pillarTitle}>{c.pillar1Title}</Text>
            <Text style={styles.pillarDesc}>{c.pillar1Sub}</Text>
          </View>
        </View>

        <View style={styles.pillarCard}>
          <View style={[styles.pillarIconWrap, { backgroundColor: '#FDF2F8' }]}>
            <Ionicons name="wallet-outline" size={18} color="#DB2777" />
          </View>
          <View style={styles.pillarTextWrap}>
            <Text style={styles.pillarTitle}>{c.pillar2Title}</Text>
            <Text style={styles.pillarDesc}>{c.pillar2Sub}</Text>
          </View>
        </View>

        <View style={styles.pillarCard}>
          <View style={[styles.pillarIconWrap, { backgroundColor: '#ECFDF5' }]}>
            <Ionicons name="flash-outline" size={18} color="#059669" />
          </View>
          <View style={styles.pillarTextWrap}>
            <Text style={styles.pillarTitle}>{c.pillar3Title}</Text>
            <Text style={styles.pillarDesc}>{c.pillar3Sub}</Text>
          </View>
        </View>
      </View>

      {/* Modern Trust Metrics Ribbon */}
      <View style={styles.statsRibbon}>
        <View style={styles.statItem}>
          <Text style={styles.statVal}>{c.statProcessed}</Text>
          <Text style={styles.statLbl}>{c.statProcessedLbl}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statVal}>{c.statUsers}</Text>
          <Text style={styles.statLbl}>{c.statUsersLbl}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statVal}>{c.statUptime}</Text>
          <Text style={styles.statLbl}>{c.statUptimeLbl}</Text>
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 2: SERVICES & NETWORK ECOSYSTEM
// ─────────────────────────────────────────────────────────────────────────────
function SlideServices({ c }: { c: typeof COPY.en }) {
  return (
    <View style={styles.slideContainer}>
      {/* Header */}
      <View style={styles.centerTextWrap}>
        <View style={styles.badgePill}>
          <Ionicons name="grid-outline" size={11} color="#2563EB" style={{ marginRight: 4 }} />
          <Text style={[styles.badgePillTxt, { color: '#2563EB' }]}>{c.slide2Badge}</Text>
        </View>
        <Text style={styles.mainTitle}>{c.slide2Title}</Text>
        <Text style={styles.mainSubtitle}>{c.slide2Sub}</Text>
      </View>

      {/* 4 Clean Service Cards in Grid */}
      <View style={styles.servicesGrid}>
        <View style={styles.serviceGridCard}>
          <View style={[styles.serviceIconCircle, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="phone-portrait-outline" size={17} color="#D97706" />
          </View>
          <Text style={styles.serviceCardTitle}>{c.srv1Title}</Text>
          <Text style={styles.serviceCardDesc}>{c.srv1Desc}</Text>
        </View>

        <View style={styles.serviceGridCard}>
          <View style={[styles.serviceIconCircle, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="call-outline" size={17} color="#2563EB" />
          </View>
          <Text style={styles.serviceCardTitle}>{c.srv2Title}</Text>
          <Text style={styles.serviceCardDesc}>{c.srv2Desc}</Text>
        </View>

        <View style={styles.serviceGridCard}>
          <View style={[styles.serviceIconCircle, { backgroundColor: '#ECFDF5' }]}>
            <Ionicons name="flash-outline" size={17} color="#059669" />
          </View>
          <Text style={styles.serviceCardTitle}>{c.srv3Title}</Text>
          <Text style={styles.serviceCardDesc}>{c.srv3Desc}</Text>
        </View>

        <View style={styles.serviceGridCard}>
          <View style={[styles.serviceIconCircle, { backgroundColor: '#F3E8FF' }]}>
            <Ionicons name="card-outline" size={17} color="#9333EA" />
          </View>
          <Text style={styles.serviceCardTitle}>{c.srv4Title}</Text>
          <Text style={styles.serviceCardDesc}>{c.srv4Desc}</Text>
        </View>
      </View>

      {/* Supported Partners Strip (Clean & Dignified) */}
      <View style={styles.partnersSection}>
        <Text style={styles.partnersHeading}>{c.partnersLabel}</Text>
        <View style={styles.networkBadgesRow}>
          <View style={[styles.networkBadge, { borderColor: '#F59E0B' }]}>
            <Text style={[styles.networkBadgeTxt, { color: '#B45309' }]}>MTN 5G</Text>
          </View>
          <View style={[styles.networkBadge, { borderColor: '#EF4444' }]}>
            <Text style={[styles.networkBadgeTxt, { color: '#DC2626' }]}>AIRTEL</Text>
          </View>
          <View style={[styles.networkBadge, { borderColor: '#10B981' }]}>
            <Text style={[styles.networkBadgeTxt, { color: '#047857' }]}>GLO</Text>
          </View>
          <View style={[styles.networkBadge, { borderColor: '#84CC16' }]}>
            <Text style={[styles.networkBadgeTxt, { color: '#4D7C0F' }]}>9MOBILE</Text>
          </View>
          <View style={[styles.networkBadge, { borderColor: '#0284C7' }]}>
            <Text style={[styles.networkBadgeTxt, { color: '#0369A1' }]}>MONIEPOINT</Text>
          </View>
          <View style={[styles.networkBadge, { borderColor: '#F43F5E' }]}>
            <Text style={[styles.networkBadgeTxt, { color: '#BE123C' }]}>WEMA</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 3: ONBOARDING STEPS & ACTION
// ─────────────────────────────────────────────────────────────────────────────
function SlideGetStarted({
  c,
  checking,
  router,
  haptic,
}: {
  c: typeof COPY.en;
  checking: boolean;
  router: any;
  haptic: () => void;
}) {
  return (
    <View style={styles.slideContainer}>
      {/* Header */}
      <View style={styles.centerTextWrap}>
        <View style={styles.badgePill}>
          <Ionicons name="rocket-outline" size={11} color="#059669" style={{ marginRight: 4 }} />
          <Text style={[styles.badgePillTxt, { color: '#059669' }]}>{c.slide3Badge}</Text>
        </View>
        <Text style={styles.mainTitle}>{c.slide3Title}</Text>
        <Text style={styles.mainSubtitle}>{c.slide3Sub}</Text>
      </View>

      {/* 3 Numbered Steps */}
      <View style={styles.stepsList}>
        <View style={styles.stepCard}>
          <View style={styles.stepNumberBadge}>
            <Text style={styles.stepNumberTxt}>{c.step1Num}</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>{c.step1Title}</Text>
            <Text style={styles.stepDesc}>{c.step1Desc}</Text>
          </View>
          <Ionicons name="checkmark-circle" size={18} color="#10B981" />
        </View>

        <View style={styles.stepCard}>
          <View style={[styles.stepNumberBadge, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
            <Text style={[styles.stepNumberTxt, { color: '#2563EB' }]}>{c.step2Num}</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>{c.step2Title}</Text>
            <Text style={styles.stepDesc}>{c.step2Desc}</Text>
          </View>
          <Ionicons name="checkmark-circle" size={18} color="#10B981" />
        </View>

        <View style={styles.stepCard}>
          <View style={[styles.stepNumberBadge, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
            <Text style={[styles.stepNumberTxt, { color: '#059669' }]}>{c.step3Num}</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>{c.step3Title}</Text>
            <Text style={styles.stepDesc}>{c.step3Desc}</Text>
          </View>
          <Ionicons name="checkmark-circle" size={18} color="#10B981" />
        </View>
      </View>

      {/* High-Converting CTA Buttons */}
      <View style={styles.ctaSection}>
        {checking ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color="#D97706" />
            <Text style={styles.loadingTxt}>{c.verifying}</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {/* Primary Action Button: Create Free Account */}
            <TouchableOpacity
              onPress={() => {
                haptic();
                router.push('/(auth)/signup');
              }}
              activeOpacity={0.88}
              style={styles.primaryCtaWrap}
            >
              <LinearGradient
                colors={['#F59E0B', '#D97706']}
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

            {/* Secondary Action Button: Sign In */}
            <TouchableOpacity
              onPress={() => {
                haptic();
                router.push('/(auth)/login');
              }}
              activeOpacity={0.8}
              style={styles.secondaryCtaBtn}
            >
              <Ionicons name="log-in-outline" size={17} color="#0F172A" style={{ marginRight: 8 }} />
              <Text style={styles.secondaryCtaTxt}>{c.btnSignin}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Security & Regulatory Trust Badge */}
      <View style={styles.securityRow}>
        <Ionicons name="shield-checkmark" size={12} color="#059669" style={{ marginRight: 5 }} />
        <Text style={styles.securityTxt}>{c.securityBadge}</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES: CLEAN, LIGHT, ULTRA-MODERN LUXURY FINTECH
// ─────────────────────────────────────────────────────────────────────────────
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  mainContentArea: {
    flex: 1,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    justifyContent: 'space-between',
  },

  // Soft modern ambient lights (clean and airy)
  ambientTopGlow: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#FEF3C7',
    opacity: 0.5,
  },
  ambientBottomGlow: {
    position: 'absolute',
    bottom: -60,
    left: -40,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#E0F2FE',
    opacity: 0.45,
  },

  // Top Bar
  topHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    zIndex: 10,
  },
  langPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  langPillTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  supportPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  supportPillTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },

  // Slide Scroll Container
  slideScroll: {
    flex: 1,
    width: '100%',
  },
  slideScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 16,
  },
  slideContainer: {
    width: '100%',
    alignItems: 'center',
  },

  // Logo Medallion
  logoMedallionWrap: {
    position: 'relative',
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCard: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
    padding: 10,
  },
  logoImg: {
    width: '100%',
    height: '100%',
  },
  verifiedCheckBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    backgroundColor: '#10B981',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  // Center Text Block
  centerTextWrap: {
    alignItems: 'center',
    marginBottom: 18,
    paddingHorizontal: 10,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  badgePillTxt: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
    letterSpacing: 0.8,
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    lineHeight: 28,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  mainSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 380,
  },

  // Pillars (Slide 1)
  pillarsContainer: {
    width: '100%',
    gap: 9,
    marginBottom: 16,
  },
  pillarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  pillarIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  pillarTextWrap: {
    flex: 1,
  },
  pillarTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 1,
  },
  pillarDesc: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    lineHeight: 15,
  },

  // Trust Stats Ribbon (Slide 1)
  statsRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    width: '100%',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statVal: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },
  statLbl: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#E2E8F0',
  },

  // Services Grid (Slide 2)
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    width: '100%',
    marginBottom: 16,
  },
  serviceGridCard: {
    width: (SCREEN_WIDTH > 440 ? 440 : SCREEN_WIDTH - 50) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  serviceIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  serviceCardTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 3,
  },
  serviceCardDesc: {
    fontSize: 10.5,
    fontWeight: '500',
    color: '#64748B',
    lineHeight: 14,
  },

  // Partners (Slide 2)
  partnersSection: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  partnersHeading: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1.1,
    marginBottom: 8,
  },
  networkBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  networkBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#F8FAFC',
  },
  networkBadgeTxt: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // Steps List (Slide 3)
  stepsList: {
    width: '100%',
    gap: 8,
    marginBottom: 16,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  stepNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  stepNumberTxt: {
    fontSize: 11,
    fontWeight: '900',
    color: '#B45309',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  stepDesc: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 1,
  },

  // CTA Section (Slide 3)
  ctaSection: {
    width: '100%',
    marginBottom: 10,
  },
  primaryCtaWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  primaryCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  primaryCtaIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  primaryCtaTextWrap: {
    flex: 1,
  },
  primaryCtaTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  primaryCtaSub: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    marginTop: 1,
  },
  secondaryCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1.2,
    borderColor: '#CBD5E1',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  secondaryCtaTxt: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  loadingTxt: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748B',
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
  },
  securityTxt: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },

  // ─── BOTTOM NAVIGATION BAR (FIXED AGAINST ANDROID NAVIGATION BAR) ───────────
  bottomNavBar: {
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 20,
    paddingTop: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 8,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    backgroundColor: '#D97706',
  },
  dotInactive: {
    backgroundColor: '#CBD5E1',
  },
  navControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  skipBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skipBtnTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  nextBtnWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 6,
  },
  nextBtnTxt: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backBtnTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
});
