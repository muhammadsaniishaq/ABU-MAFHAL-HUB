import React, { useState, useEffect, useRef } from 'react';
import { useAppSettings } from '../hooks/useAppSettings';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Dimensions,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: W, height: H } = Dimensions.get('window');

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  navy:    '#0d1b3e',
  navyMid: '#142258',
  gold:    '#f5a623',
  goldDk:  '#d4890e',
  white:   '#ffffff',
  bg:      '#f4f6fb',
  text:    '#0d1b3e',
  textSub: '#5a6890',
  indigo:  '#4F46E5',
};

// ─── Translations & Content Features ──────────────────────────────────────────
const TRANSLATIONS = {
  en: {
    skip: 'Skip',
    loginLabel: 'Already have an account? ',
    loginAction: 'Log In',
    slides: [
      {
        title: 'All Payments,\nOne Secure Sub',
        desc: 'Instantly buy airtime, cheap data plans, pay electricity bills and cable TV subscriptions without stress.',
        badge: 'CONVENIENCE',
      },
      {
        title: 'Secure & Trusted\nTransactions',
        desc: 'Your funds are protected with state-of-the-art encryption and advanced payment security protocols.',
        badge: '100% SECURE',
      },
      {
        title: 'Invite Friends &\nEarn Bonuses',
        desc: 'Share your referral code with friends and earn cash bonuses directly to your wallet on their first fund.',
        badge: 'REFER & EARN',
      },
    ],
    next: 'Next',
    getStarted: 'Get Started',
  },
  ha: {
    skip: 'Wuce',
    loginLabel: 'Kana da asusu kuwa? ',
    loginAction: 'Shiga',
    slides: [
      {
        title: 'Duk Wani Biyan Kudi,\nA Waje Guda',
        desc: 'Sayi airtime, cheap data, biya kudin wutar lantarki da na cable TV cikin sauki ba tare da bata lokaci ba.',
        badge: 'SAUKI & HANZARI',
      },
      {
        title: 'Cikakken Tsaro\nGa Kudade',
        desc: 'Kudadenku da bayanan ku suna karkashin ingantaccen tsaro na zamani da boyayyen sirri.',
        badge: '100% AMINTACCE',
      },
      {
        title: 'Gayyato Abokai\nKa Sami Kyauta',
        desc: 'Raba lambar gayyatarka (referral code) ga abokanka kuma ka sami kyautar kudi kai-tsaye zuwa walet dinka.',
        badge: 'GAYYATO A SAMU',
      },
    ],
    next: 'Gaba',
    getStarted: 'Fara Amfani',
  },
};

// ─── Slide Illustrations (Custom Premium Graphic Components) ─────────────────

function PaymentsIllustration() {
  const { settings } = useAppSettings();
  const cardRotate = useRef(new Animated.Value(0)).current;
  const chipFloat = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(cardRotate, { toValue: 1, duration: 2500, useNativeDriver: true }),
        Animated.timing(cardRotate, { toValue: 0, duration: 2500, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(chipFloat, { toValue: -6, duration: 1800, useNativeDriver: true }),
        Animated.timing(chipFloat, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const rotateStr = cardRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['-6deg', '2deg'],
  });

  // Robust logo extraction for illustration
  let illLogoUri = null;
  if (settings?.app_logo) {
    if (typeof settings.app_logo === 'string') {
      try {
        const parsed = JSON.parse(settings.app_logo);
        illLogoUri = parsed.url || parsed.uri || settings.app_logo;
      } catch (e) {
        illLogoUri = settings.app_logo;
      }
    } else {
      illLogoUri = (settings.app_logo as any).url || null;
    }
  }

  return (
    <View style={ill.container}>
      <View style={ill.glowCircleBlue} />
      <View style={[ill.miniCardBack, { transform: [{ rotate: '-15deg' }] }]}>
        <Ionicons name="wifi" size={16} color="rgba(255,255,255,0.15)" />
      </View>

      <Animated.View style={[ill.creditCard, { transform: [{ rotate: rotateStr }] }]}>
        <LinearGradient colors={['#1e293b', '#0f172a']} style={ill.cardGradient}>
          <View style={ill.cardHeader}>
            <Image 
              source={illLogoUri ? { uri: illLogoUri } : require('../assets/images/logo.png')} 
              style={ill.cardLogo} 
              resizeMode="contain" 
            />
            <Ionicons name="phone-portrait-outline" size={14} color={T.gold} />
          </View>
          <View style={ill.cardChip} />
          <Text style={ill.cardNumber}>•••• •••• •••• 5390</Text>
          <View style={ill.cardFooter}>
            <Text style={ill.cardName}>MAFHAL USER</Text>
            <View style={ill.cardBrands}>
              <View style={[ill.brandCircle, { backgroundColor: T.gold, opacity: 0.9 }]} />
              <View style={[ill.brandCircle, { backgroundColor: '#ef4444', marginLeft: -8, opacity: 0.8 }]} />
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      <Animated.View style={[ill.floatingChip, { top: 12, right: 18, transform: [{ translateY: chipFloat }] }]}>
        <LinearGradient colors={[T.gold, T.goldDk]} style={ill.chipGlow}>
          <Text style={ill.chipText}>₦ DATA</Text>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

function SecurityIllustration() {
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 8000, useNativeDriver: true })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={ill.container}>
      <Animated.View style={[ill.dashRing, { transform: [{ rotate: spin }] }]}>
        <View style={ill.dashNode} />
        <View style={[ill.dashNode, { top: undefined, bottom: 4 }]} />
      </Animated.View>

      <Animated.View style={[ill.shieldGlow, { transform: [{ scale: pulseAnim }] }]} />

      <LinearGradient colors={['#102a5a', '#081430']} style={ill.shield}>
        <Ionicons name="lock-closed" size={38} color={T.gold} />
      </LinearGradient>

      <View style={ill.successBadge}>
        <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
      </View>
    </View>
  );
}

function ReferralIllustration() {
  const coin1Float = useRef(new Animated.Value(0)).current;
  const coin2Float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(coin1Float, { toValue: -12, duration: 1600, useNativeDriver: true }),
          Animated.timing(coin1Float, { toValue: 0, duration: 1600, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(coin2Float, { toValue: -8, duration: 2000, useNativeDriver: true }),
          Animated.timing(coin2Float, { toValue: 0, duration: 2000, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  return (
    <View style={ill.container}>
      <View style={ill.glowCircleGold} />

      <LinearGradient colors={[T.gold, T.goldDk]} style={ill.giftBox}>
        <View style={ill.ribbonVert} />
        <View style={ill.ribbonHoriz} />
        <View style={ill.giftLid} />
      </LinearGradient>

      <Animated.View style={[ill.coin, { top: -2, left: 32, transform: [{ translateY: coin1Float }] }]}>
        <Text style={ill.coinTxt}>₦</Text>
      </Animated.View>

      <Animated.View style={[ill.coin, { top: 12, right: 28, transform: [{ translateY: coin2Float }] }]}>
        <Text style={ill.coinTxt}>₦</Text>
      </Animated.View>

      <Animated.View style={[ill.bonusBadge, { transform: [{ translateY: coin1Float }] }]}>
        <LinearGradient colors={['#22c55e', '#15803d']} style={ill.bonusGradient}>
          <Text style={ill.bonusText}>+₦500</Text>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

// ─── Main Onboarding Screen ──────────────────────────────────────────────────

const SLIDES = [
  {
    component: <PaymentsIllustration />,
    gradient: ['#0d1b3e', '#1c3162'] as [string, string],
  },
  {
    component: <SecurityIllustration />,
    gradient: ['#0f172a', '#1e293b'] as [string, string],
  },
  {
    component: <ReferralIllustration />,
    gradient: ['#4f46e5', '#312e81'] as [string, string],
  },
];

export default function OnboardingScreen() {
    const { settings } = useAppSettings();
  const router = useRouter();
  const [activeSlide, setActiveSlide] = useState(0);
  const [lang, setLang] = useState<'en' | 'ha'>('en');

  // Animation values
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const textSlideAnim = useRef(new Animated.Value(0)).current;

  // Background slow animation values
  const bgOrbY = useRef(new Animated.Value(0)).current;
  const bgOrbX = useRef(new Animated.Value(0)).current;

  // Marquee Ticker offset
  const tickerOffset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Parallax background orbs
    const animY = Animated.loop(
      Animated.sequence([
        Animated.timing(bgOrbY, { toValue: 12, duration: 4500, useNativeDriver: true }),
        Animated.timing(bgOrbY, { toValue: 0, duration: 4500, useNativeDriver: true }),
      ])
    );
    const animX = Animated.loop(
      Animated.sequence([
        Animated.timing(bgOrbX, { toValue: -15, duration: 5500, useNativeDriver: true }),
        Animated.timing(bgOrbX, { toValue: 0, duration: 5500, useNativeDriver: true }),
      ])
    );

    animY.start();
    animX.start();

    return () => {
      animY.stop();
      animX.stop();
    };
  }, []);

  // Marquee Scrolling Loop
  useEffect(() => {
    const runTicker = () => {
      tickerOffset.setValue(W);
      Animated.timing(tickerOffset, {
        toValue: -W * 1.5,
        duration: 16000,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) runTicker();
      });
    };
    runTicker();
  }, []);

  // Bulletproof logo extraction for Header
  const getLogo = () => {
    try {
      if (settings?.app_logo) {
        if (typeof settings.app_logo === 'string') {
          if (settings.app_logo.trim().startsWith('{')) {
            const parsed = JSON.parse(settings.app_logo);
            if (parsed.url || parsed.uri) return parsed.url || parsed.uri;
          }
          return settings.app_logo;
        }
        if ((settings.app_logo as any).url || (settings.app_logo as any).uri) {
          return (settings.app_logo as any).url || (settings.app_logo as any).uri;
        }
      }
      if (settings?.app_logo_icon) {
        if (typeof settings.app_logo_icon === 'string') {
          if (settings.app_logo_icon.trim().startsWith('{')) {
            const parsed = JSON.parse(settings.app_logo_icon);
            if (parsed.url || parsed.uri) return parsed.url || parsed.uri;
          }
          return settings.app_logo_icon;
        }
        if ((settings.app_logo_icon as any).url || (settings.app_logo_icon as any).uri) {
          return (settings.app_logo_icon as any).url || (settings.app_logo_icon as any).uri;
        }
      }
    } catch (e) { console.log('Error parsing logo:', e); }
    return null;
  };
  const finalLogoUri = getLogo();

  const animateToSlide = (nextIndex: number) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(textSlideAnim, { toValue: 12, duration: 160, useNativeDriver: true }),
    ]).start(() => {
      setActiveSlide(nextIndex);
      textSlideAnim.setValue(-12);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(textSlideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  };

  const handleNext = () => {
    if (activeSlide < SLIDES.length - 1) {
      animateToSlide(activeSlide + 1);
    } else {
      router.push('/(auth)/signup');
    }
  };

  const handleSkip = () => {
    router.push('/(auth)/signup');
  };

  const handleDotPress = (index: number) => {
    if (index !== activeSlide) {
      animateToSlide(index);
    }
  };

  const toggleLanguage = () => {
    setLang(lang === 'en' ? 'ha' : 'en');
  };

  const content = TRANSLATIONS[lang];
  const slideText = content.slides[activeSlide];
  const slideConfig = SLIDES[activeSlide];

  return (
    <View style={s.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="dark" />

      {/* Background Gradients Matching index.tsx */}
      <LinearGradient colors={['#030B1C', '#0A1E4A', '#030B1C']} style={StyleSheet.absoluteFillObject} />

      {/* Multiple Decorative Swirls simulating the rich gold/blue waves */}
      <View style={s.glow2} />
      <View style={s.swirl1} />
      <View style={s.swirl2} />
      <View style={s.swirl3} />
      <View style={s.swirl4} />
      <View style={s.glow1} />

      {/* Floating Particles for extra decoration */}
      <View style={[s.particle, { top: '15%', left: '15%', width: 8, height: 8 }]} />
      <View style={[s.particle, { top: '35%', right: '12%', width: 6, height: 6, opacity: 0.8 }]} />
      <View style={[s.particle, { top: '55%', left: '8%', width: 10, height: 10, opacity: 0.6 }]} />
      <View style={[s.particle, { bottom: '25%', right: '20%', width: 7, height: 7 }]} />

      <SafeAreaView style={s.safeArea}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.brandRow}>
            {/* Logo wrapped with decorations */}
            <View style={s.logoCircle}>
              <View style={s.logoInnerCircle}>
                <Image
                  source={finalLogoUri ? { uri: finalLogoUri } : require('../assets/images/logo.png')}
                  style={s.logo}
                  resizeMode="contain"
                />
              </View>
            </View>
            <View>
              <Text style={s.brandTxt}>MAFHAL</Text>
              <Text style={s.brandSub}>SUB</Text>
            </View>
          </View>

          {/* Features Row in Header: Language Selector & Skip */}
          <View style={s.headerActions}>
            <TouchableOpacity onPress={toggleLanguage} activeOpacity={0.8} style={s.langBtn}>
              <Ionicons name="globe-outline" size={12} color={T.navy} />
              <Text style={s.langText}>{lang === 'en' ? 'Hausa' : 'English'}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleSkip} activeOpacity={0.7} style={s.skipBtn}>
              <Text style={s.skipTxt}>{content.skip}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Marquee Network Status Ticker */}
        <View style={s.tickerContainer}>
          <Animated.View style={[s.tickerWrapper, { transform: [{ translateX: tickerOffset }] }]}>
            <Text style={s.tickerTxt} numberOfLines={1}>
              MTN: Active 🟢  •  Airtel: Active 🟢  •  Glo: Active 🟢  •  9mobile: Active 🟢  •  Instant Wallet Funding: Online ⚡
            </Text>
          </Animated.View>
        </View>

        {/* Content Area */}
        <View style={s.contentContainer}>
          {/* Card Wrapper containing BOTH illustration and text */}
          <LinearGradient
            colors={slideConfig.gradient}
            style={s.slideCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {/* Glossy overlay effect */}
            <View style={s.glassOverlay} />
            
            {/* Slide Badge */}
            <Animated.View style={[s.badge, { opacity: fadeAnim }]}>
              <Text style={s.badgeTxt}>{slideText.badge}</Text>
            </Animated.View>

            {/* Graphic Illustration */}
            <Animated.View style={{ flex: 1, justifyContent: 'center', opacity: fadeAnim, transform: [{ scale: fadeAnim }] }}>
              {slideConfig.component}
            </Animated.View>

            {/* Text Content Merged Inside Card */}
            <Animated.View style={[s.textWrapper, { opacity: fadeAnim, transform: [{ translateY: textSlideAnim }] }]}>
              <Text style={s.title}>{slideText.title}</Text>
              <Text style={s.desc}>{slideText.desc}</Text>
            </Animated.View>
          </LinearGradient>
        </View>

        {/* Footer controls */}
        <View style={s.footer}>
          {/* Page Indicators */}
          <View style={s.indicatorRow}>
            {SLIDES.map((_, i) => {
              const isActive = i === activeSlide;
              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => handleDotPress(i)}
                  activeOpacity={0.7}
                  style={[
                    s.dot,
                    isActive ? s.dotActive : null,
                    { backgroundColor: isActive ? T.gold : T.textSub + '30' },
                  ]}
                />
              );
            })}
          </View>

          {/* Next Button */}
          <TouchableOpacity
            style={s.nextBtn}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[T.navy, T.navyMid]}
              style={s.nextBtnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={s.nextBtnTxt}>
                {activeSlide === SLIDES.length - 1 ? content.getStarted : content.next}
              </Text>
              <Ionicons
                name={activeSlide === SLIDES.length - 1 ? 'arrow-forward' : 'chevron-forward'}
                size={18}
                color={T.white}
              />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Log In prompt */}
        <View style={s.loginLinkRow}>
          <Text style={s.loginLabel}>{content.loginLabel}</Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text style={s.loginAction}>{content.loginAction}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ─── Illustration Specific Styles ───────────────────────────────────────────
const ill = StyleSheet.create({
  container: {
    width: 260,
    height: 180,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowCircleBlue: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(59,130,246,0.18)',
    filter: Platform.OS === 'web' ? 'blur(20px)' : undefined,
  },
  glowCircleGold: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(245,166,35,0.18)',
    filter: Platform.OS === 'web' ? 'blur(20px)' : undefined,
  },
  miniCardBack: {
    position: 'absolute',
    width: 140,
    height: 90,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    top: 20,
    left: 20,
    padding: 10,
  },
  creditCard: {
    width: 170,
    height: 108,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  cardGradient: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardLogo: {
    width: 20,
    height: 20,
  },
  cardChip: {
    width: 24,
    height: 18,
    borderRadius: 4,
    backgroundColor: T.gold,
    opacity: 0.85,
    marginVertical: 4,
  },
  cardNumber: {
    color: T.white,
    fontFamily: 'monospace',
    fontSize: 11,
    letterSpacing: 1.5,
    opacity: 0.9,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardName: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 8,
    fontWeight: '700',
  },
  cardBrands: {
    flexDirection: 'row',
  },
  brandCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  floatingChip: {
    position: 'absolute',
    shadowColor: T.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  chipGlow: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: T.white,
  },
  chipText: {
    fontSize: 8,
    fontWeight: '800',
    color: T.navy,
  },

  // Security Illustration
  dashRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1.5,
    borderColor: 'rgba(245, 166, 35, 0.25)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashNode: {
    position: 'absolute',
    top: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: T.gold,
  },
  shieldGlow: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(245, 166, 35, 0.1)',
  },
  shield: {
    width: 80,
    height: 92,
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: T.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: T.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    marginTop: -20,
  },
  slideCard: {
    height: 480, // Taller to fit both animation and text
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 30,
    paddingTop: 10,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(247, 201, 72, 0.4)', // Beautiful gold border to match the rest of the app
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 15,
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  badge: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    zIndex: 2,
  },
  badgeTxt: {
    color: T.white,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  textWrapper: {
    marginTop: 10,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  successBadge: {
    position: 'absolute',
    bottom: 24,
    right: 76,
    backgroundColor: T.white,
    borderRadius: 99,
    padding: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },

  // Referral Illustration
  giftBox: {
    width: 86,
    height: 76,
    borderRadius: 14,
    position: 'relative',
    borderWidth: 1.5,
    borderColor: T.white,
    shadowColor: T.gold,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  ribbonVert: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '42%',
    width: 12,
    backgroundColor: T.navy,
    opacity: 0.85,
  },
  ribbonHoriz: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '42%',
    height: 12,
    backgroundColor: T.navy,
    opacity: 0.85,
  },
  giftLid: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    height: 12,
    borderRadius: 3,
    backgroundColor: T.gold,
    borderWidth: 1,
    borderColor: T.white,
  },
  coin: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: T.gold,
    borderWidth: 1.5,
    borderColor: T.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  coinTxt: {
    fontSize: 10,
    fontWeight: '900',
    color: T.navy,
  },
  bonusBadge: {
    position: 'absolute',
    bottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  bonusGradient: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.white,
  },
  bonusText: {
    color: T.white,
    fontSize: 9,
    fontWeight: '900',
  },
});

// ─── Main StyleSheet ──────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.white,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  bgDecorationContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
    overflow: 'hidden',
  },
  bgOrb: {
    position: 'absolute',
  },
  dotPatternRow: {
    position: 'absolute',
    top: H * 0.28,
    right: 20,
    opacity: 0.12,
  },
  dotPatternLine: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  dotPatternNode: {
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: T.navy,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    zIndex: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Added decorations for logo in onboarding
  logoCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(10,30,74,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(247, 201, 72, 0.4)',
    shadowColor: T.gold,
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
  },
  logoInnerCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(247, 201, 72, 1)',
  },
  logo: {
    width: 28,
    height: 28,
  },
  brandTxt: {
    fontSize: 13,
    fontWeight: '900',
    color: T.navy,
    letterSpacing: 0.3,
    lineHeight: 15,
  },
  brandSub: {
    fontSize: 8,
    fontWeight: '700',
    color: T.gold,
    letterSpacing: 1.2,
    lineHeight: 10,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  langText: {
    fontSize: 11,
    fontWeight: '800',
    color: T.white,
  },
  skipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  skipTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: T.gold,
  },
  tickerContainer: {
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    overflow: 'hidden',
    marginHorizontal: -24,
    marginTop: 8,
    zIndex: 10,
  },
  tickerWrapper: {
    flexDirection: 'row',
  },
  tickerTxt: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: 0.5,
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
    zIndex: 10,
  },
  slideCard: {
    width: '100%',
    height: W > 768 ? 295 : W * 0.65,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(247, 201, 72, 0.4)', // Beautiful gold border to match the rest of the app
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 15,
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  badge: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(247, 201, 72, 0.4)',
    zIndex: 2,
  },
  badgeTxt: {
    color: T.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  textWrapper: {
    marginTop: 10,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: W > 768 ? 32 : 24,
    fontWeight: '900',
    color: T.white, // Changed to white for dark backgrounds
    textAlign: 'center',
    lineHeight: W > 768 ? 38 : 30,
    marginBottom: 12,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  desc: {
    fontSize: W > 768 ? 15 : 13.5,
    color: 'rgba(255, 255, 255, 0.85)', // Changed to light white
    textAlign: 'center',
    lineHeight: 21,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    zIndex: 10,
  },
  indicatorRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 18,
  },
  nextBtn: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  nextBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  nextBtnTxt: {
    fontSize: 13,
    fontWeight: '800',
    color: T.white,
  },
  loginLinkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 24,
    zIndex: 10,
  },
  loginLabel: {
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.7)', // Changed to light white
    fontWeight: '500',
  },
  loginAction: {
    fontSize: 12.5,
    color: T.gold, // Changed from indigo to gold to match theme
    fontWeight: '800',
  },
  
  // Rich Decorations Matching index.tsx
  swirl1: { 
    position: 'absolute', top: '-10%', left: '-50%', width: W * 2, height: 400, 
    borderRadius: W, borderWidth: 1.5, borderColor: 'rgba(247, 201, 72, 0.2)', 
    transform: [{ rotate: '-15deg' }] 
  },
  swirl2: { 
    position: 'absolute', top: '5%', left: '-40%', width: W * 1.8, height: 350, 
    borderRadius: W, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', 
    transform: [{ rotate: '-10deg' }] 
  },
  swirl3: { 
    position: 'absolute', bottom: '-15%', right: '-50%', width: W * 2, height: 500, 
    borderRadius: W, borderWidth: 1.5, borderColor: 'rgba(247, 201, 72, 0.15)', 
    transform: [{ rotate: '25deg' }] 
  },
  swirl4: { 
    position: 'absolute', bottom: '0%', right: '-40%', width: W * 1.5, height: 400, 
    borderRadius: W, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)', 
    transform: [{ rotate: '35deg' }] 
  },
  glow1: {
    position: 'absolute', top: '15%', left: '10%', width: W * 0.8, height: W * 0.8,
    borderRadius: W * 0.4, backgroundColor: 'rgba(247, 201, 72, 0.08)',
  },
  glow2: {
    position: 'absolute', bottom: '10%', right: '-20%', width: W * 1.2, height: W * 1.2,
    borderRadius: W * 0.6, backgroundColor: 'rgba(10, 30, 74, 0.8)',
  },
  particle: {
    position: 'absolute', backgroundColor: T.gold, borderRadius: 50,
    shadowColor: T.gold, shadowOpacity: 1, shadowRadius: 8, elevation: 5
  },
});
