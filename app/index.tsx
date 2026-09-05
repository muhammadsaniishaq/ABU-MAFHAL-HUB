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
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { supabase, processOAuthReturn } from '../services/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';

type LangKey = 'en' | 'ha';

// ─── COPY ─────────────────────────────────────────────────────────────────────
const COPY = {
  en: {
    lang: '🇳🇬 HA',
    live: 'LIVE · 99.98% UPTIME',
    motto: 'TRUST  ·  QUALITY  ·  VALUE',
    brand: 'ABU MAFHAL',
    sub: 'SUB',
    tagline: 'Premium Automated Telecom\n& Smart Financial Hub',
    trusted: '★★★★★  Trusted by 50,000+ Resellers',
    processed: '₦2.5B+',
    processedLbl: 'Processed',
    resellers: '50K+',
    resellersLbl: 'Resellers',
    uptime: '99.9%',
    uptimeLbl: 'Uptime',
    p2Title: 'Everything You Need',
    p2Sub: 'All telecom & payment needs in one place',
    p3Title: 'How It Works',
    p3Sub: 'Start earning in 3 simple steps',
    p3Badge: 'VIP LAUNCHPAD',
    p3MascotName: 'Khadijah · Banking Lead',
    p3MascotSpeech: '“Open your dedicated bank account with ₦0 fee and start in 30 seconds!”',
    p3MascotPerk: 'Zero Setup Fee · Instant Bank Account',
    p3Step1Title: 'Auto Wallet',
    p3Step1Desc: 'Virtual Bank',
    p3Step1Tag: 'Moniepoint · Wema',
    p3Step2Title: 'Pick & Buy',
    p3Step2Desc: '5G Data & Bills',
    p3Step2Tag: '0.4s Instant API',
    p3Step3Title: 'Earn & Profit',
    p3Step3Desc: '3% Cashback',
    p3Step3Tag: 'Wholesale Rates',
    p3LiveTitle: 'AUTOMATED DISPATCH ENGINE',
    p3LiveActive: 'LIVE · 0.4s SPEED',
    p3FreeTag: 'FREE · 30 SECONDS',
    steps: ['Fund Your\nWallet', 'Pick a\nService', 'Get Instant\nDelivery'],
    stepIcons: ['wallet-outline', 'grid-outline', 'checkmark-done-circle-outline'] as const,
    signin: 'Sign In to Account',
    signup: 'Create Free Account',
    skip: 'Skip',
    next: 'Next',
    back: 'Back to start',
    networks: 'SUPPORTED NETWORKS',
    verify: 'Verifying session...',
    ssl: 'Bank-Grade 256-Bit SSL · NDPA Protected',
    notifTitle: 'Purchase Successful!',
    notifBody: '₦1,000 MTN Airtime — delivered instantly',
    partnersTitle: 'OFFICIAL TELECOM & BANKING PARTNERS',
  },
  ha: {
    lang: '🇬🇧 EN',
    live: 'TSARIN YA AIKI · 99.98%',
    motto: 'AMINCI  ·  INGANCI  ·  DARAJA',
    brand: 'ABU MAFHAL',
    sub: 'SUB',
    tagline: 'Babban Dandalin Sayen Data\nda Biyan Kudi Cikin Sauki',
    trusted: '★★★★★  Amintacce ga Masu Amfani 50,000+',
    processed: '₦2.5B+',
    processedLbl: 'An Sarrafa',
    resellers: '50K+',
    resellersLbl: 'Masu Amfani',
    uptime: '99.9%',
    uptimeLbl: 'Nasara',
    p2Title: 'Duk Abin Da Kake Bukata',
    p2Sub: 'Sayen data, airtime da biyan kudi a wuri guda',
    p3Title: 'Yadda Ake Fara Amfani',
    p3Sub: 'Fara samun riba cikin matakai 3 kacal',
    p3Badge: 'KADDAMAR DA ASUSU',
    p3MascotName: 'Khadijah · Kwararriyar Asusu',
    p3MascotSpeech: '“Sami lambar asusun bankinka ta musamman kyauta ka fara a sakan 30!”',
    p3MascotPerk: 'Babu Kudin Bude Asusu · Nan Take',
    p3Step1Title: 'Cika Wallet',
    p3Step1Desc: 'Lambar Banki',
    p3Step1Tag: 'Moniepoint · Wema',
    p3Step2Title: 'Zabi Sabis',
    p3Step2Desc: 'Data 5G da Bil',
    p3Step2Tag: 'Sakan 0.4 Ana Turawa',
    p3Step3Title: 'Samu Riba',
    p3Step3Desc: '3% Kyauta',
    p3Step3Tag: 'Farashin Sari',
    p3LiveTitle: 'TSARIN AIKI NA KAI TSAYE',
    p3LiveActive: 'KAI TSAYE · SAKAN 0.4',
    p3FreeTag: 'KYAUTA · SAKAN 30',
    steps: ['Cika\nWallet', 'Zabi\nSabis', 'Karba\nNan Take'],
    stepIcons: ['wallet-outline', 'grid-outline', 'checkmark-done-circle-outline'] as const,
    signin: 'Shiga Cikin Asusu',
    signup: 'Bude Sabon Asusu Kyauta',
    skip: 'Tsallake',
    next: 'Gaba',
    back: 'Komawa farko',
    networks: 'LAYUKAN DA MUKE GOYAN BAYA',
    verify: 'Ana duba asusu...',
    ssl: 'Tsaro na Banki · An Kare Bayananku',
    notifTitle: 'An Yi Cinikin!',
    notifBody: 'Katin MTN ₦1,000 — an tura nan take',
    partnersTitle: 'ABOKAN HULDARMU NA GASKIYA',
  },
};

const AVATAR_FEATURES = [
  {
    id: 'data',
    avatar: require('../assets/images/avatar_data.jpg'),
    color: '#38bdf8',
    glowColor: 'rgba(56, 189, 248, 0.4)',
    icon: 'wifi' as const,
    en: {
      name: 'Zack · 5G Specialist',
      shortLabel: '5G Data',
      title: '5G High-Speed Data',
      badge: 'TOP SELLER',
      speech: '“Hey! I deliver blazing 5G SME & Corporate Data from ₦215/GB in 2 seconds flat! ⚡”',
      stat: 'From ₦215/GB',
      speed: '2-Second Delivery',
    },
    ha: {
      name: 'Zack · Kwararre kan Data',
      shortLabel: 'Data 5G',
      title: 'Ingantacciyar Data 5G',
      badge: 'MAFI SHAHARA',
      speech: '“Sannu! Ina tura maka Data 5G ta SME da Gifting a kan ₦215/GB cikin sakan 2 kacal! ⚡”',
      stat: 'Daga ₦215/GB',
      speed: 'Tsayawa Nan Take',
    },
  },
  {
    id: 'airtime',
    avatar: require('../assets/images/avatar_airtime.jpg'),
    color: '#f5a623',
    glowColor: 'rgba(245, 166, 35, 0.4)',
    icon: 'flash' as const,
    en: {
      name: 'Amara · Speed Pro',
      shortLabel: 'Airtime',
      title: 'Instant Airtime VTU',
      badge: '3% CASHBACK',
      speech: '“Recharge MTN, Airtel, Glo or 9mobile instantly with up to 3% cash rebate to your pocket! 💰”',
      stat: 'Up to 3% Back',
      speed: 'Zero-Wait VTU',
    },
    ha: {
      name: 'Amara · Kwararriyar Airtime',
      shortLabel: 'Airtime',
      title: 'Katin Waya Nan Take',
      badge: 'RAGIN 3%',
      speech: '“Sayi katin waya nan take zuwa kowane layi tare da samun ragi na 3% a kan kowane ciniki! 💰”',
      stat: 'Ragin 3%',
      speed: 'Cika Nan Take',
    },
  },
  {
    id: 'bills',
    avatar: require('../assets/images/avatar_bills.jpg'),
    color: '#10b981',
    glowColor: 'rgba(16, 185, 129, 0.4)',
    icon: 'bulb' as const,
    en: {
      name: 'Tariq · Utilities Hero',
      shortLabel: 'Power & TV',
      title: 'Electricity & Cable TV',
      badge: 'INSTANT TOKEN',
      speech: '“Never get left in the dark! Get prepaid tokens & renew DStv/GOtv in 5 seconds with receipts! 💡”',
      stat: '< 5s Token',
      speed: '24/7 Available',
    },
    ha: {
      name: 'Tariq · Kwararren NEPA & TV',
      shortLabel: 'Wuta & TV',
      title: 'Wutar Lantarki & TV',
      badge: 'TOKEN NAN TAKE',
      speech: '“Kada a bar ka a duhu! Samo lambar wuta da biyan DStv & GOtv cikin sakan 5 tare da shaidar biya! 💡”',
      stat: '< 5s Token',
      speed: 'Aiki Dare da Rana',
    },
  },
  {
    id: 'wallet',
    avatar: require('../assets/images/avatar_wallet.jpg'),
    color: '#a855f7',
    glowColor: 'rgba(168, 85, 247, 0.4)',
    icon: 'card' as const,
    en: {
      name: 'Khadijah · Banking Lead',
      shortLabel: 'Accounts',
      title: 'Dedicated Bank Accounts',
      badge: 'AUTO-CREDIT',
      speech: '“Get automated Moniepoint, Wema & Sterling accounts that credit your wallet in 0 seconds! 🏦”',
      stat: '0-Sec Credit',
      speed: 'Bank-Grade SSL',
    },
    ha: {
      name: 'Khadijah · Kwararriyar Asusu',
      shortLabel: 'Asusun Banki',
      title: 'Asusun Banki na Musamman',
      badge: 'KUDI NAN TAKE',
      speech: '“Samu asusun banki na Moniepoint, Wema da Sterling wanda ke shiga wallet a take 0-sakan! 🏦”',
      stat: '0-Sakan Kudi',
      speed: 'Tsaro na Banki',
    },
  },
];

const PARTNER_ITEMS = [
  { id: 'mtn', name: 'MTN 5G', img: require('../assets/images/mtn.png'), color: '#f5a623' },
  { id: 'airtel', name: 'Airtel', img: require('../assets/images/airtel.png'), color: '#ef4444' },
  { id: 'glo', name: 'Glo', img: require('../assets/images/glo.png'), color: '#22c55e' },
  { id: '9mobile', name: '9mobile', img: require('../assets/images/9mobile.png'), color: '#84cc16' },
  { id: 'moniepoint', name: 'Moniepoint', icon: 'business' as const, color: '#38bdf8' },
  { id: 'wema', name: 'Wema Bank', icon: 'card' as const, color: '#f43f5e' },
  { id: 'sterling', name: 'Sterling', icon: 'shield-checkmark' as const, color: '#fb923c' },
  { id: 'dstv', name: 'DStv', img: require('../assets/images/dstv.png'), color: '#38bdf8' },
  { id: 'gotv', name: 'GOtv', img: require('../assets/images/gotv.png'), color: '#fb923c' },
  { id: 'startimes', name: 'StarTimes', img: require('../assets/images/startimes.png'), color: '#f59e0b' },
  { id: 'aedc', name: 'AEDC Power', img: require('../assets/images/aedc.png'), color: '#10b981' },
  { id: 'ekedc', name: 'EKEDC Power', img: require('../assets/images/ekedc.png'), color: '#06b6d4' },
];

const NETWORKS = [
  { name: 'MTN', color: '#f5c518', bg: 'rgba(245,197,24,0.15)' },
  { name: 'Airtel', color: '#ff3b3b', bg: 'rgba(255,59,59,0.15)' },
  { name: 'Glo', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
  { name: '9mobile', color: '#a3e635', bg: 'rgba(163,230,53,0.15)' },
];

const P3_SIMULATED_TRANSACTIONS = [
  {
    icon: 'wifi' as const,
    color: '#38bdf8',
    serviceEn: 'MTN 5G SME 10GB',
    serviceHa: 'MTN 5G SME 10GB',
    target: '0814 ••• 5291',
    amount: '₦2,450',
    statusEn: 'DELIVERED · 0.3s',
    statusHa: 'AN TURA · 0.3s',
    tag: '5G SME',
  },
  {
    icon: 'wallet' as const,
    color: '#f5a623',
    serviceEn: 'Auto Wallet Fund',
    serviceHa: 'Zuba Kudi a Wallet',
    target: 'Moniepoint Virtual',
    amount: '+₦15,000',
    statusEn: 'CREDITED · 0.0s',
    statusHa: 'YA SHIGA · 0.0s',
    tag: 'AUTO BANK',
  },
  {
    icon: 'flash' as const,
    color: '#10b981',
    serviceEn: 'AEDC Prepaid Token',
    serviceHa: 'Token din Wutar AEDC',
    target: 'Meter 4509 ••• 1102',
    amount: '₦5,000',
    statusEn: 'TOKEN READY',
    statusHa: 'TOKEN YA FITO',
    tag: 'INSTANT TOKEN',
  },
  {
    icon: 'call' as const,
    color: '#a855f7',
    serviceEn: 'Airtel Airtime + Bonus',
    serviceHa: 'Katin Airtel + Riba',
    target: '0802 ••• 8823',
    amount: '₦2,000',
    statusEn: 'CASHBACK ADDED',
    statusHa: 'AN BA DA CASHBACK',
    tag: '3% CASHBACK',
  },
];

const LOGO_WRAP_SIZE = 220;

// ─── ANIMATED DOT ─────────────────────────────────────────────────────────────
function Dot({ active, color }: { active: boolean; color: string }) {
  const w = useSharedValue(active ? 22 : 7);
  const op = useSharedValue(active ? 1 : 0.35);
  useEffect(() => {
    w.value = withSpring(active ? 22 : 7, { damping: 14, stiffness: 110 });
    op.value = withTiming(active ? 1 : 0.35, { duration: 250 });
  }, [active]);
  const a = useAnimatedStyle(() => ({ width: w.value, opacity: op.value }));
  return <Animated.View style={[{ height: 7, borderRadius: 4, backgroundColor: color }, a]} />;
}

// ─── SPINNING RING (Pixel-perfect centered) ──────────────────────────────────
function SpinRing({
  size,
  delay,
  color,
  speed,
  reverse,
}: {
  size: number;
  delay: number;
  color: string;
  speed: number;
  reverse?: boolean;
}) {
  const rot = useSharedValue(0);
  const op = useSharedValue(0);
  useEffect(() => {
    op.value = withDelay(delay, withTiming(1, { duration: 600 }));
    rot.value = withRepeat(
      withTiming(reverse ? -360 : 360, { duration: speed, easing: Easing.linear }),
      -1,
      false
    );
  }, []);
  const a = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ rotate: `${rot.value}deg` }],
  }));

  const pos = (LOGO_WRAP_SIZE - size) / 2;
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: pos,
          left: pos,
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1.2,
          borderColor: color,
          borderStyle: 'dashed',
        },
        a,
      ]}
    />
  );
}

// ─── SHIMMER BEAM ─────────────────────────────────────────────────────────────
function ShimmerBeam() {
  const tx = useSharedValue(-150);
  useEffect(() => {
    tx.value = withRepeat(
      withSequence(
        withTiming(150, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        withDelay(2600, withTiming(-150, { duration: 0 }))
      ),
      -1,
      false
    );
  }, []);
  const a = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { rotate: '28deg' }],
  }));
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          zIndex: 2,
          width: 48,
          height: 180,
          backgroundColor: 'rgba(255,255,255,0.18)',
          borderRadius: 28,
        },
        a,
      ]}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 1 — WELCOME
// ─────────────────────────────────────────────────────────────────────────────
function PageWelcome({
  c,
  lang,
  setLang,
  haptic,
}: {
  c: typeof COPY.en;
  lang: LangKey;
  setLang: (fn: (l: LangKey) => LangKey) => void;
  haptic: () => void;
}) {
  const logoSc = useSharedValue(0);
  const logoOp = useSharedValue(0);
  const haloSc = useSharedValue(1);
  const titleOp = useSharedValue(0);
  const titleY = useSharedValue(20);
  const statsOp = useSharedValue(0);
  const statsY = useSharedValue(16);

  useEffect(() => {
    logoOp.value = withDelay(100, withTiming(1, { duration: 400 }));
    logoSc.value = withDelay(100, withSpring(1, { damping: 9, stiffness: 72 }));
    titleOp.value = withDelay(300, withTiming(1, { duration: 450 }));
    titleY.value = withDelay(300, withTiming(0, { duration: 450, easing: Easing.out(Easing.cubic) }));
    statsOp.value = withDelay(500, withTiming(1, { duration: 450 }));
    statsY.value = withDelay(500, withTiming(0, { duration: 450, easing: Easing.out(Easing.cubic) }));
    haloSc.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const aLogo = useAnimatedStyle(() => ({
    opacity: logoOp.value,
    transform: [{ scale: logoSc.value }],
  }));
  const aHalo = useAnimatedStyle(() => ({ transform: [{ scale: haloSc.value }] }));
  const aTitle = useAnimatedStyle(() => ({
    opacity: titleOp.value,
    transform: [{ translateY: titleY.value }],
  }));
  const aStats = useAnimatedStyle(() => ({
    opacity: statsOp.value,
    transform: [{ translateY: statsY.value }],
  }));

  const haloPos = (LOGO_WRAP_SIZE - 180) / 2;

  return (
    <View style={pg.root}>
      {/* Ambient background glows */}
      <View style={pg.blobA} />
      <View style={pg.blobB} />

      {/* ─── Top bar ─── */}
      <View style={pg.topBar}>
        <View style={pg.livePill}>
          <View style={pg.liveDot} />
          <Text style={pg.liveTxt}>{c.live}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => {
              haptic();
              setLang(l => (l === 'en' ? 'ha' : 'en'));
            }}
            style={pg.langBtn}
            activeOpacity={0.8}
          >
            <Text style={pg.langTxt}>{c.lang}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              Linking.openURL('https://wa.me/2348144445438?text=Hello%20Abu%20Mafhal%20Support')
            }
            style={pg.waBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-whatsapp" size={13} color="#25D366" />
            <Text style={pg.waTxt}>24/7</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── Logo medallion ─── */}
      <Animated.View style={[pg.logoWrap, aLogo]}>
        {/* Breathing halo glow */}
        <Animated.View
          style={[
            pg.haloGlow,
            { top: haloPos, left: haloPos, width: 180, height: 180, borderRadius: 90 },
            aHalo,
          ]}
        />

        {/* 4 Concentric spinning rings */}
        <SpinRing size={214} delay={800} color="rgba(168,85,247,0.12)" speed={22000} reverse />
        <SpinRing size={192} delay={500} color="rgba(56,189,248,0.16)" speed={17000} />
        <SpinRing size={170} delay={250} color="rgba(255,255,255,0.10)" speed={13000} reverse />
        <SpinRing size={148} delay={0} color="rgba(245,166,35,0.38)" speed={9000} />

        {/* Gold medallion container */}
        <View style={pg.medallion}>
          <LinearGradient
            colors={['#ffe566', '#f5a623', '#b87015', '#f5a623', '#ffe566']}
            locations={[0, 0.2, 0.5, 0.8, 1]}
            style={pg.medalGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={pg.medalInner}>
              <ShimmerBeam />
              <Image
                source={require('../assets/images/logo.png')}
                style={pg.logoImg}
                resizeMode="contain"
              />
            </View>
          </LinearGradient>
        </View>

        {/* Verified badge */}
        <View style={pg.vBadge}>
          <LinearGradient
            colors={['#f5a623', '#c77d10']}
            style={pg.vBadgeIn}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="checkmark" size={10} color="#010812" />
          </LinearGradient>
        </View>
        {/* Star badge */}
        <View style={pg.starBadge}>
          <Ionicons name="star" size={8} color="#010812" />
        </View>
      </Animated.View>

      {/* ─── Brand block ─── */}
      <Animated.View style={[pg.brandBlock, aTitle]}>
        {/* Motto ribbon */}
        <View style={pg.mottoRow}>
          <View style={pg.mottoDash} />
          <View style={pg.mottoPill}>
            <Ionicons name="shield-checkmark" size={10} color="#f5a623" style={{ marginRight: 4 }} />
            <Text style={pg.mottoTxt}>{c.motto}</Text>
          </View>
          <View style={pg.mottoDash} />
        </View>

        {/* Brand name + SUB chip */}
        <View style={pg.brandRow}>
          <Text style={pg.brandName}>{c.brand}</Text>
          <LinearGradient
            colors={['#f5a623', '#c77d10']}
            style={pg.subChip}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={pg.subTxt}>{c.sub}</Text>
          </LinearGradient>
        </View>

        <Text style={pg.tagline}>{c.tagline}</Text>
        <Text style={pg.trusted}>{c.trusted}</Text>
      </Animated.View>

      {/* ─── Trust stats bar ─── */}
      <Animated.View style={[pg.statsBar, aStats]}>
        <View style={pg.statBox}>
          <Text style={pg.statNum}>{c.processed}</Text>
          <Text style={pg.statLbl}>{c.processedLbl}</Text>
        </View>
        <View style={pg.statDiv} />
        <View style={pg.statBox}>
          <Text style={pg.statNum}>{c.resellers}</Text>
          <Text style={pg.statLbl}>{c.resellersLbl}</Text>
        </View>
        <View style={pg.statDiv} />
        <View style={pg.statBox}>
          <Text style={pg.statNum}>{c.uptime}</Text>
          <Text style={pg.statLbl}>{c.uptimeLbl}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

// ─── PARTNER LOGOS MARQUEE (Moving tape) ────────────────────────────────────
function PartnerMarquee({ title }: { title: string }) {
  const scrollX = useSharedValue(0);
  const CHIP_WIDTH = 104;
  const TOTAL_WIDTH = PARTNER_ITEMS.length * (CHIP_WIDTH + 8);

  useEffect(() => {
    scrollX.value = 0;
    scrollX.value = withRepeat(
      withTiming(-TOTAL_WIDTH, {
        duration: 20000,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, []);

  const marqueeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: scrollX.value }],
  }));

  const doubled = [...PARTNER_ITEMS, ...PARTNER_ITEMS];

  return (
    <View style={marq.wrap}>
      <View style={marq.headerRow}>
        <View style={marq.dot} />
        <Text style={marq.title}>{title}</Text>
        <View style={marq.dot} />
      </View>

      <View style={marq.marqueeContainer}>
        {/* Left & Right gradient edge masks */}
        <LinearGradient
          colors={['#08173d', 'transparent']}
          style={marq.maskLeft}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          pointerEvents="none"
        />

        <Animated.View style={[marq.tape, marqueeStyle]}>
          {doubled.map((p, idx) => (
            <View key={idx} style={[marq.chip, { borderColor: p.color + '40' }]}>
              {p.img ? (
                <Image source={p.img} style={marq.chipImg} resizeMode="contain" />
              ) : (
                <Ionicons name={p.icon as any} size={13} color={p.color} style={{ marginRight: 5 }} />
              )}
              <Text style={[marq.chipText, { color: p.color }]} numberOfLines={1}>{p.name}</Text>
            </View>
          ))}
        </Animated.View>

        <LinearGradient
          colors={['transparent', '#08173d']}
          style={marq.maskRight}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          pointerEvents="none"
        />
      </View>
    </View>
  );
}

// ─── SPEAKING AVATAR CARD ───────────────────────────────────────────────────
function SpeakingAvatarCard({
  lang,
  haptic,
}: {
  lang: LangKey;
  haptic: () => void;
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const slideAnim = useSharedValue(0);
  const opacityAnim = useSharedValue(1);
  const bobAnim = useSharedValue(0);

  useEffect(() => {
    bobAnim.value = withRepeat(
      withSequence(
        withTiming(-5, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setNextAvatar();
    }, 4800);
    return () => clearInterval(timer);
  }, [activeIdx]);

  const changeTo = (idx: number, dir: 'next' | 'prev') => {
    haptic();
    slideAnim.value = dir === 'next' ? 28 : -28;
    opacityAnim.value = 0.3;
    setActiveIdx(idx);
    slideAnim.value = withSpring(0, { damping: 15, stiffness: 120 });
    opacityAnim.value = withTiming(1, { duration: 250 });
  };

  const setNextAvatar = () => {
    const next = (activeIdx + 1) % AVATAR_FEATURES.length;
    changeTo(next, 'next');
  };

  const setPrevAvatar = () => {
    const prev = (activeIdx - 1 + AVATAR_FEATURES.length) % AVATAR_FEATURES.length;
    changeTo(prev, 'prev');
  };

  const current = AVATAR_FEATURES[activeIdx];
  const info = current[lang];

  const avatarAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bobAnim.value }],
  }));

  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideAnim.value }],
    opacity: opacityAnim.value,
  }));

  return (
    <View style={avc.container}>
      {/* 4 Avatar Selector Tabs */}
      <View style={avc.pillsRow}>
        {AVATAR_FEATURES.map((item, i) => {
          const isSelected = i === activeIdx;
          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => changeTo(i, i > activeIdx ? 'next' : 'prev')}
              activeOpacity={0.8}
              style={[
                avc.tabPill,
                isSelected && {
                  backgroundColor: item.color + '22',
                  borderColor: item.color,
                },
              ]}
            >
              <Ionicons
                name={item.icon}
                size={11}
                color={isSelected ? item.color : '#94a3b8'}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  avc.tabPillTxt,
                  isSelected && { color: '#ffffff', fontWeight: '900' },
                ]}
              >
                {item[lang].shortLabel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Main Interactive Stage */}
      <Animated.View style={[avc.stageCard, cardAnimStyle]}>
        {/* Glow halo behind active avatar */}
        <View style={[avc.glowOrb, { backgroundColor: current.glowColor }]} />

        {/* Top: Character Speaking Header */}
        <View style={avc.speakerHeader}>
          <View style={[avc.speakerBadge, { backgroundColor: current.color + '22', borderColor: current.color + '55' }]}>
            <View style={[avc.speakingDot, { backgroundColor: current.color }]} />
            <Text style={[avc.speakerName, { color: current.color }]}>
              {info.name}
            </Text>
          </View>
          <View style={avc.roleBadge}>
            <Ionicons name="sparkles" size={10} color="#f5a623" style={{ marginRight: 3 }} />
            <Text style={avc.roleText}>{info.badge}</Text>
          </View>
        </View>

        {/* Mid: Avatar & Connected Speech Bubble */}
        <View style={avc.avatarBodyRow}>
          {/* 3D Animated Cartoon Avatar */}
          <Animated.View style={[avc.avatarFrame, { borderColor: current.color }, avatarAnimStyle]}>
            <Image source={current.avatar} style={avc.avatarImg} resizeMode="cover" />
            <View style={[avc.avatarStatusDot, { backgroundColor: '#10b981' }]} />
          </Animated.View>

          {/* Talking Speech Bubble */}
          <View style={[avc.speechBubble, { borderColor: current.color + '45' }]}>
            <LinearGradient
              colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']}
              style={[StyleSheet.absoluteFillObject, { borderRadius: 14 }]}
            />
            {/* Speech Tail */}
            <View style={[avc.speechTail, { borderRightColor: current.color + '45' }]} />

            <Text style={avc.speechText} numberOfLines={3}>
              {info.speech}
            </Text>

            <View style={avc.statChipRow}>
              <View style={[avc.statChip, { backgroundColor: current.color + '25', borderColor: current.color + '50' }]}>
                <Text style={[avc.statChipText, { color: current.color }]}>{info.stat}</Text>
              </View>
              <View style={avc.speedChip}>
                <Ionicons name="flash" size={9} color="#f5a623" style={{ marginRight: 2 }} />
                <Text style={avc.speedChipText}>{info.speed}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Bottom Slide Controller (Prev < Dots > Next) */}
        <View style={avc.navControls}>
          <TouchableOpacity onPress={setPrevAvatar} style={avc.arrowBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={15} color="#ffffff" />
          </TouchableOpacity>

          {/* Slide dots */}
          <View style={avc.dotsRow}>
            {AVATAR_FEATURES.map((_, i) => (
              <TouchableOpacity key={i} onPress={() => changeTo(i, i > activeIdx ? 'next' : 'prev')}>
                <View
                  style={[
                    avc.slideDot,
                    i === activeIdx
                      ? { width: 18, backgroundColor: current.color }
                      : { width: 6, backgroundColor: 'rgba(255,255,255,0.2)' },
                  ]}
                />
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity onPress={setNextAvatar} style={avc.arrowBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-forward" size={15} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 2 — FEATURES (Everything You Need)
// ─────────────────────────────────────────────────────────────────────────────
function PageFeatures({
  lang,
  c,
  haptic,
}: {
  lang: LangKey;
  c: typeof COPY.en;
  haptic: () => void;
}) {
  return (
    <View style={p2.root}>
      <View style={p2.blobA} />
      <View style={p2.blobB} />

      {/* Header */}
      <View style={p2.header}>
        <View style={p2.badge}>
          <Ionicons name="sparkles" size={11} color="#f5a623" style={{ marginRight: 5 }} />
          <Text style={p2.badgeTxt}>OUR AI AVATARS</Text>
        </View>
        <Text style={p2.title}>{c.p2Title}</Text>
        <Text style={p2.sub}>{c.p2Sub}</Text>
      </View>

      {/* Interactive Talking Cartoon Avatar Slide */}
      <SpeakingAvatarCard lang={lang} haptic={haptic} />

      {/* Moving Partner Logos Tape */}
      <PartnerMarquee title={c.partnersTitle} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 3 HELPERS: Mascot, Steps & Live Simulator
// ─────────────────────────────────────────────────────────────────────────────
function P3MascotWelcome({
  c,
}: {
  c: typeof COPY.en;
}) {
  const floatAnim = useSharedValue(0);

  useEffect(() => {
    floatAnim.value = withRepeat(
      withSequence(
        withTiming(-3, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );
  }, []);

  const animatedAvatar = useAnimatedStyle(() => ({
    transform: [{ translateY: floatAnim.value }],
  }));

  return (
    <View style={p3.mascotCard}>
      <LinearGradient
        colors={['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.02)']}
        style={[StyleSheet.absoluteFillObject, { borderRadius: 14 }]}
      />
      {/* 3D Mascot Avatar */}
      <Animated.View style={[p3.mascotAvatarWrap, animatedAvatar]}>
        <Image
          source={require('../assets/images/avatar_wallet.jpg')}
          style={p3.mascotAvatarImg}
          resizeMode="cover"
        />
        <View style={p3.mascotOnlineBadge}>
          <View style={p3.mascotOnlineDot} />
        </View>
      </Animated.View>

      {/* Speech Bubble / Info */}
      <View style={p3.mascotTextCol}>
        <View style={p3.mascotHeaderRow}>
          <Text style={p3.mascotName}>{c.p3MascotName}</Text>
          <View style={p3.mascotVipBadge}>
            <Ionicons name="sparkles" size={9} color="#f5a623" style={{ marginRight: 3 }} />
            <Text style={p3.mascotVipTxt}>VIP AUTO</Text>
          </View>
        </View>
        <Text style={p3.mascotSpeech} numberOfLines={2}>
          {c.p3MascotSpeech}
        </Text>
        <View style={p3.mascotPerkRow}>
          <Ionicons name="checkmark-circle" size={10} color="#10b981" style={{ marginRight: 3 }} />
          <Text style={p3.mascotPerkTxt}>{c.p3MascotPerk}</Text>
        </View>
      </View>
    </View>
  );
}

function P3StepMatrix({
  c,
  haptic,
}: {
  c: typeof COPY.en;
  haptic: () => void;
}) {
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      num: '01',
      icon: 'wallet' as const,
      color: '#f5a623',
      title: c.p3Step1Title,
      desc: c.p3Step1Desc,
      tag: c.p3Step1Tag,
    },
    {
      num: '02',
      icon: 'flash' as const,
      color: '#38bdf8',
      title: c.p3Step2Title,
      desc: c.p3Step2Desc,
      tag: c.p3Step2Tag,
    },
    {
      num: '03',
      icon: 'trending-up' as const,
      color: '#10b981',
      title: c.p3Step3Title,
      desc: c.p3Step3Desc,
      tag: c.p3Step3Tag,
    },
  ];

  return (
    <View style={p3.stepsMatrixRow}>
      {steps.map((s, i) => {
        const isSelected = activeStep === i;
        return (
          <TouchableOpacity
            key={i}
            activeOpacity={0.82}
            onPress={() => {
              haptic();
              setActiveStep(i);
            }}
            style={[
              p3.stepCard,
              {
                borderColor: isSelected ? s.color : s.color + '33',
                backgroundColor: isSelected ? s.color + '18' : 'rgba(255,255,255,0.035)',
              },
            ]}
          >
            {/* Step header with number and icon */}
            <View style={p3.stepCardHeader}>
              <View style={[p3.stepNumPill, { backgroundColor: s.color + '25', borderColor: s.color + '55' }]}>
                <Text style={[p3.stepNumText, { color: s.color }]}>{s.num}</Text>
              </View>
              <View style={[p3.stepIconCircle, { backgroundColor: s.color + '20' }]}>
                <Ionicons name={s.icon} size={13} color={s.color} />
              </View>
            </View>

            {/* Title & Desc */}
            <Text style={[p3.stepCardTitle, isSelected && { color: '#ffffff' }]} numberOfLines={1}>
              {s.title}
            </Text>
            <Text style={p3.stepCardDesc} numberOfLines={1}>
              {s.desc}
            </Text>

            {/* Bottom tag */}
            <View style={[p3.stepTagPill, { backgroundColor: s.color + '15', borderColor: s.color + '30' }]}>
              <Text style={[p3.stepTagTxt, { color: s.color }]} numberOfLines={1}>
                {s.tag}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function P3LiveSimulator({
  lang,
  c,
}: {
  lang: LangKey;
  c: typeof COPY.en;
}) {
  const [txIndex, setTxIndex] = useState(0);
  const opacityAnim = useSharedValue(1);
  const slideAnim = useSharedValue(0);

  useEffect(() => {
    const interval = setInterval(() => {
      opacityAnim.value = withTiming(0, { duration: 180 }, () => {
        slideAnim.value = 8;
        opacityAnim.value = withTiming(1, { duration: 240 });
        slideAnim.value = withSpring(0, { damping: 14, stiffness: 120 });
      });
      setTxIndex(prev => (prev + 1) % P3_SIMULATED_TRANSACTIONS.length);
    }, 3400);

    return () => clearInterval(interval);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacityAnim.value,
    transform: [{ translateY: slideAnim.value }],
  }));

  const item = P3_SIMULATED_TRANSACTIONS[txIndex];
  const serviceName = lang === 'ha' ? item.serviceHa : item.serviceEn;
  const statusText = lang === 'ha' ? item.statusHa : item.statusEn;

  return (
    <View style={p3.simCard}>
      <LinearGradient
        colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']}
        style={[StyleSheet.absoluteFillObject, { borderRadius: 12 }]}
      />
      {/* Header bar of the ticker */}
      <View style={p3.simHeader}>
        <View style={p3.simRadarRow}>
          <View style={p3.simRadarDot} />
          <Text style={p3.simHeaderTitle}>{c.p3LiveTitle}</Text>
        </View>
        <View style={p3.simSpeedBadge}>
          <Ionicons name="speedometer-outline" size={9} color="#10b981" style={{ marginRight: 3 }} />
          <Text style={p3.simSpeedTxt}>{c.p3LiveActive}</Text>
        </View>
      </View>

      {/* Animated content */}
      <Animated.View style={[p3.simBody, animatedStyle]}>
        <View style={[p3.simIconWrap, { backgroundColor: item.color + '22', borderColor: item.color + '55' }]}>
          <Ionicons name={item.icon} size={15} color={item.color} />
        </View>

        <View style={p3.simInfoCol}>
          <Text style={p3.simServiceText} numberOfLines={1}>
            {serviceName}
          </Text>
          <Text style={p3.simTargetText} numberOfLines={1}>
            {item.target}
          </Text>
        </View>

        <View style={p3.simRightCol}>
          <Text style={p3.simAmountText}>{item.amount}</Text>
          <View style={[p3.simStatusBadge, { backgroundColor: '#10b98125', borderColor: '#10b98155' }]}>
            <Text style={p3.simStatusText}>{statusText}</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 3 — GET STARTED (Smart Financial Launchpad & Live Automation Engine)
// ─────────────────────────────────────────────────────────────────────────────
function PageGetStarted({
  c,
  lang,
  checking,
  router,
  haptic,
}: {
  c: typeof COPY.en;
  lang: LangKey;
  checking: boolean;
  router: any;
  haptic: () => void;
}) {
  return (
    <View style={p3.root}>
      <View style={p3.blobA} />
      <View style={p3.blobB} />

      {/* Header */}
      <View style={p3.header}>
        <View style={p3.badge}>
          <Ionicons name="flash" size={10} color="#f5a623" style={{ marginRight: 5 }} />
          <Text style={p3.badgeTxt}>{c.p3Badge}</Text>
        </View>
        <Text style={p3.title}>{c.p3Title}</Text>
        <Text style={p3.sub}>{c.p3Sub}</Text>
      </View>

      {/* VIP Onboarding Mascot Welcome Card */}
      <P3MascotWelcome c={c} />

      {/* Interactive 3-Step Glassmorphic Matrix */}
      <P3StepMatrix c={c} haptic={haptic} />

      {/* Live Automated Dispatch Simulator */}
      <P3LiveSimulator lang={lang} c={c} />

      {/* Action Buttons Block */}
      <View style={p3.btnBlock}>
        {checking ? (
          <View style={p3.loadCard}>
            <ActivityIndicator size="small" color="#f5a623" />
            <Text style={p3.loadTxt}>{c.verify}</Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {/* Primary Action: Create Free Account */}
            <TouchableOpacity
              onPress={() => {
                haptic();
                router.push('/(auth)/signup');
              }}
              activeOpacity={0.87}
              style={p3.primaryWrap}
            >
              <LinearGradient
                colors={['#ffe566', '#f5a623', '#d07a10', '#b06010']}
                locations={[0, 0.33, 0.7, 1]}
                style={p3.primaryBtn}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <View style={p3.primaryLeftIcon}>
                  <Ionicons name="sparkles" size={15} color="#010812" />
                </View>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={p3.primaryTxt}>{c.signup}</Text>
                  <Text style={p3.primarySubTxt}>{c.p3FreeTag}</Text>
                </View>
                <View style={p3.arrow}>
                  <Ionicons name="arrow-forward" size={12} color="#010812" />
                </View>
              </LinearGradient>
            </TouchableOpacity>

            {/* Secondary Action: Sign In to Account */}
            <TouchableOpacity
              onPress={() => {
                haptic();
                router.push('/(auth)/login');
              }}
              activeOpacity={0.8}
              style={p3.secondaryBtn}
            >
              <Ionicons name="log-in-outline" size={15} color="#38bdf8" style={{ marginRight: 6 }} />
              <Text style={p3.secondaryTxt}>{c.signin}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* SSL & Trust Footnote */}
      <View style={p3.sslRow}>
        <Ionicons name="shield-checkmark" size={11} color="#10b981" />
        <Text style={p3.sslTxt}>{c.ssl}</Text>
        <Text style={p3.sslDivider}>•</Text>
        <Ionicons name="flash" size={10} color="#f5a623" />
        <Text style={p3.sslTxt}>99.98% Automated</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function SplashScreen() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [lang, setLang] = useState<LangKey>('en');
  const [pageIdx, setPageIdx] = useState(0);
  const PAGE_COLORS = ['#f5a623', '#38bdf8', '#10b981'];

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
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const unlocked = await AsyncStorage.getItem('app_unlocked');
      if (session?.user) {
        setTimeout(
          () => router.replace(unlocked === 'true' ? ('/dashboard' as any) : ('/pin' as any)),
          500
        );
      } else {
        await AsyncStorage.removeItem('has_active_session');
        await AsyncStorage.removeItem('app_unlocked');
        setChecking(false);
      }
    } catch {
      await AsyncStorage.removeItem('has_active_session');
      await AsyncStorage.removeItem('app_unlocked');
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

  // Touch gesture handlers for swipe left/right
  const handleTouchStart = (e: any) => {
    touchStartX.current = e.nativeEvent.pageX;
    touchStartY.current = e.nativeEvent.pageY;
  };

  const handleTouchEnd = (e: any) => {
    const dx = e.nativeEvent.pageX - touchStartX.current;
    const dy = e.nativeEvent.pageY - touchStartY.current;
    // Only detect swipe if horizontal movement is dominant and > 40px
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      if (dx < 0) {
        // Swiped left -> next page
        goNext();
      } else {
        // Swiped right -> previous page
        goPrev();
      }
    }
  };

  const c = COPY[lang];

  return (
    <View style={root.outerScreen}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Modern Royal Cyber-Navy Gradient (Luminous & Rich, never pitch black) */}
      <LinearGradient
        colors={['#071434', '#0d2561', '#14388e', '#0d2561', '#071434']}
        locations={[0, 0.2, 0.5, 0.8, 1]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
      />

      {/* Floating ambient glow lights */}
      <View style={root.ambientOrbCyan} pointerEvents="none" />
      <View style={root.ambientOrbGold} pointerEvents="none" />
      <View style={root.ambientOrbIndigo} pointerEvents="none" />

      {/* Main app frame */}
      <View
        style={root.appFrame}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <SafeAreaView style={root.safeArea} edges={['top']}>
          {/* Active page rendering */}
          <View style={root.pageContent}>
            {pageIdx === 0 && (
              <PageWelcome c={c} lang={lang} setLang={setLang} haptic={haptic} />
            )}
            {pageIdx === 1 && <PageFeatures lang={lang} c={c} haptic={haptic} />}
            {pageIdx === 2 && (
              <PageGetStarted
                c={c}
                lang={lang}
                checking={checking}
                router={router}
                haptic={haptic}
              />
            )}
          </View>
        </SafeAreaView>

        {/* Bottom Navigation Bar */}
        <View style={root.navBar}>
          {/* Dot indicators */}
          <View style={root.dots}>
            {[0, 1, 2].map(i => (
              <TouchableOpacity
                key={i}
                onPress={() => goToPage(i)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Dot active={pageIdx === i} color={PAGE_COLORS[i]} />
              </TouchableOpacity>
            ))}
          </View>

          {/* Navigation Controls */}
          <View style={root.navRow}>
            {pageIdx < 2 ? (
              <>
                <TouchableOpacity onPress={goSkip} style={root.skipBtn} activeOpacity={0.7}>
                  <Text style={root.skipTxt}>{c.skip}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={goNext} style={root.nextWrap} activeOpacity={0.87}>
                  <LinearGradient
                    colors={['#f5a623', '#c77d10']}
                    style={root.nextBtn}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={root.nextTxt}>{c.next}</Text>
                    <Ionicons name="arrow-forward" size={14} color="#010812" />
                  </LinearGradient>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity onPress={() => goToPage(0)} style={root.backBtn} activeOpacity={0.75}>
                <Ionicons name="arrow-back" size={14} color="#94a3b8" style={{ marginRight: 5 }} />
                <Text style={root.backTxt}>{c.back}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════════════════════

// ─── Root ────────────────────────────────────────────────────────────────────
const root = StyleSheet.create({
  outerScreen: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#071434',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appFrame: {
    flex: 1,
    width: '100%',
    maxWidth: 460,
    height: '100%',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  ambientOrbCyan: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: '#0284c7',
    opacity: 0.18,
  },
  ambientOrbGold: {
    position: 'absolute',
    top: '35%',
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#d97706',
    opacity: 0.14,
  },
  ambientOrbIndigo: {
    position: 'absolute',
    bottom: 30,
    right: -40,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#4338ca',
    opacity: 0.18,
  },
  safeArea: {
    flex: 1,
    width: '100%',
  },
  pageContent: {
    flex: 1,
    width: '100%',
  },
  navBar: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 20 : 12,
    paddingTop: 8,
    backgroundColor: 'rgba(7, 20, 52, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 5,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  skipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  skipTxt: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  nextWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#f5a623',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 9,
    paddingHorizontal: 18,
  },
  nextTxt: {
    color: '#010812',
    fontSize: 13.5,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  backTxt: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
});

// ─── Page 1: Welcome ─────────────────────────────────────────────────────────
const pg = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // Background blobs
  blobA: {
    position: 'absolute',
    top: -50,
    right: -40,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(245,166,35,0.12)',
  },
  blobB: {
    position: 'absolute',
    bottom: 20,
    left: -50,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(14,42,120,0.32)',
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 18,
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.28)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  liveTxt: {
    color: '#10b981',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  langBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  langTxt: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  waBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(37,211,102,0.11)',
    borderWidth: 1,
    borderColor: 'rgba(37,211,102,0.26)',
  },
  waTxt: {
    color: '#25D366',
    fontSize: 9,
    fontWeight: '800',
  },

  // Logo wrapper: Fixed 220×220 box
  logoWrap: {
    width: LOGO_WRAP_SIZE,
    height: LOGO_WRAP_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  haloGlow: {
    position: 'absolute',
    backgroundColor: 'rgba(245,166,35,0.12)',
    shadowColor: '#f5a623',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 36,
    elevation: 16,
  },
  medallion: {
    width: 132,
    height: 132,
    borderRadius: 66,
    padding: 3,
    shadowColor: '#f5a623',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 18,
  },
  medalGrad: {
    flex: 1,
    borderRadius: 63,
    padding: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medalInner: {
    width: '100%',
    height: '100%',
    borderRadius: 61,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImg: {
    width: 118,
    height: 118,
  },
  vBadge: {
    position: 'absolute',
    bottom: 20,
    right: 16,
    shadowColor: '#f5a623',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 7,
  },
  vBadgeIn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#010812',
  },
  starBadge: {
    position: 'absolute',
    top: 20,
    right: 16,
    width: 19,
    height: 19,
    borderRadius: 9.5,
    backgroundColor: '#f5a623',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#010812',
  },

  // Brand
  brandBlock: {
    alignItems: 'center',
    width: '100%',
  },
  mottoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    width: '100%',
  },
  mottoDash: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(245,166,35,0.22)',
  },
  mottoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 16,
    backgroundColor: 'rgba(245,166,35,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.26)',
  },
  mottoTxt: {
    color: '#f5a623',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 4,
  },
  brandName: {
    color: '#ffffff',
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  subChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  subTxt: {
    color: '#010812',
    fontSize: 11.5,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  tagline: {
    color: '#8ea4c4',
    fontSize: 11.5,
    textAlign: 'center',
    lineHeight: 16.5,
    marginBottom: 5,
  },
  trusted: {
    color: '#f5a623',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // Stats bar
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statNum: {
    color: '#f5a623',
    fontSize: 14,
    fontWeight: '900',
  },
  statLbl: {
    color: '#64748b',
    fontSize: 8.5,
    fontWeight: '700',
    marginTop: 1.5,
    letterSpacing: 0.2,
  },
  statDiv: {
    width: 1,
    height: 22,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
});

// ─── Page 2: Features ────────────────────────────────────────────────────────
const p2 = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 2,
    justifyContent: 'space-between',
  },
  blobA: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(56,189,248,0.1)',
  },
  blobB: {
    position: 'absolute',
    bottom: 20,
    left: -30,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(168,85,247,0.09)',
  },
  header: {
    marginBottom: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.28)',
    backgroundColor: 'rgba(245,166,35,0.1)',
    marginBottom: 4,
  },
  badgeTxt: {
    color: '#f5a623',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 1.3,
  },
  title: {
    color: '#ffffff',
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  sub: {
    color: '#94a3b8',
    fontSize: 10.5,
    fontWeight: '500',
  },
});

// ─── Talking Avatar Card Styles ─────────────────────────────────────────────
const avc = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 4,
  },
  pillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
    gap: 5,
  },
  tabPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tabPillTxt: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
  },
  stageCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  glowOrb: {
    position: 'absolute',
    top: -20,
    left: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    opacity: 0.35,
  },
  speakerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  speakerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 12,
    borderWidth: 1,
  },
  speakingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  speakerName: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,166,35,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.25)',
  },
  roleText: {
    color: '#f5a623',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  avatarBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  avatarFrame: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2.5,
    padding: 2,
    position: 'relative',
    backgroundColor: '#0c1a3d',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 42,
  },
  avatarStatusDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#061333',
  },
  speechBubble: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.2,
    padding: 10,
    position: 'relative',
    backgroundColor: 'rgba(10, 22, 54, 0.75)',
    justifyContent: 'space-between',
    minHeight: 88,
  },
  speechTail: {
    position: 'absolute',
    left: -8,
    top: 32,
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderRightWidth: 8,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  speechText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  statChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  statChipText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  speedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  speedChipText: {
    color: '#e2e8f0',
    fontSize: 9,
    fontWeight: '700',
  },
  navControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  arrowBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  slideDot: {
    height: 5,
    borderRadius: 3,
  },
});

// ─── Partner Marquee Styles ─────────────────────────────────────────────────
const marq = StyleSheet.create({
  wrap: {
    width: '100%',
    marginTop: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 6,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#f5a623',
    opacity: 0.7,
  },
  title: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  marqueeContainer: {
    width: '100%',
    height: 38,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  maskLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 32,
    zIndex: 10,
  },
  maskRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 32,
    zIndex: 10,
  },
  tape: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    minWidth: 88,
    justifyContent: 'center',
  },
  chipImg: {
    width: 18,
    height: 18,
    marginRight: 6,
  },
  chipText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});

// ─── Page 3: Get Started ─────────────────────────────────────────────────────
const p3 = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 4,
    justifyContent: 'space-between',
  },
  blobA: {
    position: 'absolute',
    top: -40,
    left: -30,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(245,166,35,0.08)',
  },
  blobB: {
    position: 'absolute',
    bottom: 20,
    right: -30,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(16,185,129,0.07)',
  },

  header: {
    marginBottom: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.3)',
    backgroundColor: 'rgba(245,166,35,0.12)',
    marginBottom: 4,
  },
  badgeTxt: {
    color: '#f5a623',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    color: '#ffffff',
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 0.2,
    marginBottom: 1,
  },
  sub: {
    color: '#8ea4c4',
    fontSize: 10.5,
    fontWeight: '500',
  },

  // Mascot Card
  mascotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.22)',
    backgroundColor: 'rgba(13,37,97,0.45)',
    gap: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  mascotAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#f5a623',
    position: 'relative',
  },
  mascotAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },
  mascotOnlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#071434',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascotOnlineDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10b981',
  },
  mascotTextCol: {
    flex: 1,
    gap: 1,
  },
  mascotHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 1,
  },
  mascotName: {
    color: '#f0f4ff',
    fontSize: 11,
    fontWeight: '800',
  },
  mascotVipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 8,
    backgroundColor: 'rgba(245,166,35,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.3)',
  },
  mascotVipTxt: {
    color: '#f5a623',
    fontSize: 7.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  mascotSpeech: {
    color: '#cbd5e1',
    fontSize: 9.5,
    fontWeight: '500',
    lineHeight: 13,
  },
  mascotPerkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  mascotPerkTxt: {
    color: '#10b981',
    fontSize: 8.5,
    fontWeight: '700',
  },

  // Steps Matrix
  stepsMatrixRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  stepCard: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 3,
  },
  stepCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 2,
    marginBottom: 2,
  },
  stepNumPill: {
    paddingHorizontal: 4.5,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
  },
  stepNumText: {
    fontSize: 8,
    fontWeight: '900',
  },
  stepIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCardTitle: {
    color: '#f1f5f9',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  stepCardDesc: {
    color: '#94a3b8',
    fontSize: 8,
    fontWeight: '600',
    textAlign: 'center',
  },
  stepTagPill: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 1,
  },
  stepTagTxt: {
    fontSize: 7.5,
    fontWeight: '800',
  },

  // Live Simulator
  simCard: {
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.22)',
    backgroundColor: 'rgba(13,37,97,0.4)',
    position: 'relative',
    overflow: 'hidden',
  },
  simHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  simRadarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  simRadarDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  simHeaderTitle: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
  },
  simSpeedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  simSpeedTxt: {
    color: '#10b981',
    fontSize: 8,
    fontWeight: '800',
  },
  simBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  simIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  simInfoCol: {
    flex: 1,
  },
  simServiceText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  simTargetText: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '500',
  },
  simRightCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  simAmountText: {
    color: '#f5a623',
    fontSize: 11,
    fontWeight: '900',
  },
  simStatusBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  simStatusText: {
    color: '#10b981',
    fontSize: 7.5,
    fontWeight: '800',
  },

  // Buttons Block
  btnBlock: {},
  loadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  loadTxt: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  primaryWrap: {
    borderRadius: 13,
    overflow: 'hidden',
    shadowColor: '#f5a623',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.42,
    shadowRadius: 10,
    elevation: 8,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  primaryLeftIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(1,8,18,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryTxt: {
    color: '#010812',
    fontSize: 13.5,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  primarySubTxt: {
    color: 'rgba(1,8,18,0.68)',
    fontSize: 7.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 1,
  },
  arrow: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(1,8,18,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  secondaryTxt: {
    color: '#dde4ef',
    fontSize: 12,
    fontWeight: '700',
  },

  // SSL
  sslRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    justifyContent: 'center',
  },
  sslTxt: {
    color: '#64748b',
    fontSize: 8.5,
    fontWeight: '600',
  },
  sslDivider: {
    color: '#334155',
    fontSize: 8,
  },
});
