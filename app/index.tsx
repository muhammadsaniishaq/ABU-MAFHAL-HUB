import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  useWindowDimensions,
  Platform,
  StatusBar,
  ActivityIndicator,
  Linking,
  FlatList,
  ViewToken,
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
    steps: ['Fund Your\nWallet', 'Pick a\nService', 'Get Instant\nDelivery'],
    stepIcons: ['wallet-outline', 'grid-outline', 'checkmark-done-circle-outline'] as const,
    signin: 'Sign In to Account',
    signup: 'Create Free Account',
    skip: 'Skip',
    next: 'Next',
    networks: 'SUPPORTED NETWORKS',
    verify: 'Verifying session...',
    ssl: 'Bank-Grade 256-Bit SSL · NDPA Protected',
    notifTitle: 'Purchase Successful!',
    notifBody: '₦1,000 MTN Airtime — delivered instantly',
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
    p3Sub: 'Fara samun riba cikin matakai 3',
    steps: ['Cika\nWallet', 'Zabi\nSabis', 'Karba\nNan Take'],
    stepIcons: ['wallet-outline', 'grid-outline', 'checkmark-done-circle-outline'] as const,
    signin: 'Shiga Cikin Asusu',
    signup: 'Bude Sabon Asusu Kyauta',
    skip: 'Tsallake',
    next: 'Gaba',
    networks: 'LAYUKAN DA MUKE GOYAN BAYA',
    verify: 'Ana duba asusu...',
    ssl: 'Tsaro na Banki · An Kare Bayananku',
    notifTitle: 'An Yi Cinikin!',
    notifBody: 'Katin MTN ₦1,000 — an tura nan take',
  },
};

const FEATURES = [
  {
    id: 'data',
    icon: 'wifi' as const,
    color: '#38bdf8',
    en: { title: '5G High-Speed Data', badge: 'FROM ₦215/GB', stat: '₦215/GB', sub: 'SME, Corporate & Gifting for MTN, Airtel, Glo & 9mobile.' },
    ha: { title: 'Ingantacciyar Data', badge: 'DAGA ₦215/GB', stat: '₦215/GB', sub: 'Data na SME, Gifting da Corporate MTN, Airtel, Glo, 9mobile.' },
  },
  {
    id: 'airtime',
    icon: 'flash' as const,
    color: '#f5a623',
    en: { title: 'Instant Airtime VTU', badge: 'UP TO 3% BACK', stat: '3% Back', sub: 'Automated VTU for all networks with real-time cashback.' },
    ha: { title: 'Sayen Katin Waya', badge: 'RAGIN 3%', stat: '3% Ragi', sub: 'Katin waya nan take zuwa kowane layi tare da cashback.' },
  },
  {
    id: 'bills',
    icon: 'bulb' as const,
    color: '#10b981',
    en: { title: 'Electricity & Cable TV', badge: 'INSTANT TOKEN', stat: '< 5 Secs', sub: 'Prepaid tokens IKEDC/AEDC & DStv, GOtv, Startimes.' },
    ha: { title: 'Biyan Wutar Lantarki', badge: 'TOKEN NAN TAKE', stat: '< 5 Sak.', sub: 'Samo lambar wuta da biyan DStv, GOtv da Startimes cikin sakan 5.' },
  },
  {
    id: 'wallet',
    icon: 'card' as const,
    color: '#a855f7',
    en: { title: 'Virtual Bank Accounts', badge: 'AUTO-CREDIT', stat: '0-Second', sub: 'Dedicated accounts Moniepoint, Wema & Sterling.' },
    ha: { title: 'Asusun Banki na Musamman', badge: 'KUDI NAN TAKE', stat: '0-Sakan', sub: 'Asusun banki daga Moniepoint, Wema da Sterling auto-credit.' },
  },
  {
    id: 'cashback',
    icon: 'gift' as const,
    color: '#f43f5e',
    en: { title: 'Earn & Refer Profits', badge: 'DAILY INCOME', stat: 'Daily ₦₦', sub: 'Cashback on every purchase plus referral commissions.' },
    ha: { title: 'Samun Riba da Garabasa', badge: 'KARIN KUDI', stat: 'Riba Kullum', sub: 'Cashback a kowane ciniki tare da alawus na gayyato abokai.' },
  },
];

const NETWORKS = [
  { name: 'MTN', color: '#f5c518', bg: 'rgba(245,197,24,0.15)' },
  { name: 'Airtel', color: '#ff3b3b', bg: 'rgba(255,59,59,0.15)' },
  { name: 'Glo', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
  { name: '9mobile', color: '#a3e635', bg: 'rgba(163,230,53,0.15)' },
];

const LOGO_WRAP_SIZE = 240;

// ─── ANIMATED DOT ─────────────────────────────────────────────────────────────
function Dot({ active, color }: { active: boolean; color: string }) {
  const w = useSharedValue(active ? 22 : 7);
  const op = useSharedValue(active ? 1 : 0.35);
  useEffect(() => {
    w.value = withSpring(active ? 22 : 7, { damping: 13, stiffness: 110 });
    op.value = withTiming(active ? 1 : 0.35, { duration: 250 });
  }, [active]);
  const a = useAnimatedStyle(() => ({ width: w.value, opacity: op.value }));
  return <Animated.View style={[{ height: 7, borderRadius: 4, backgroundColor: color }, a]} />;
}

// ─── SPINNING RING (Pixel-perfect centered without percentage quirks) ────────
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
  const tx = useSharedValue(-160);
  useEffect(() => {
    tx.value = withRepeat(
      withSequence(
        withTiming(160, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        withDelay(2600, withTiming(-160, { duration: 0 }))
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
          width: 50,
          height: 190,
          backgroundColor: 'rgba(255,255,255,0.18)',
          borderRadius: 30,
        },
        a,
      ]}
    />
  );
}

// ─── FLOATING PARTICLE ────────────────────────────────────────────────────────
function Particle({
  x,
  y,
  delay,
  size,
  color,
}: {
  x: number;
  y: number;
  delay: number;
  size: number;
  color: string;
}) {
  const op = useSharedValue(0);
  const ty = useSharedValue(0);
  useEffect(() => {
    op.value = withDelay(
      delay,
      withRepeat(
        withSequence(withTiming(0.85, { duration: 1400 }), withTiming(0, { duration: 1400 })),
        -1,
        false
      )
    );
    ty.value = withDelay(
      delay,
      withRepeat(withTiming(-36, { duration: 2800, easing: Easing.inOut(Easing.ease) }), -1, true)
    );
  }, []);
  const a = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ translateY: ty.value }],
  }));
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: x,
          top: y,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
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
  pageWidth,
}: {
  c: typeof COPY.en;
  lang: LangKey;
  setLang: (fn: (l: LangKey) => LangKey) => void;
  haptic: () => void;
  pageWidth: number;
}) {
  const logoSc = useSharedValue(0);
  const logoOp = useSharedValue(0);
  const haloSc = useSharedValue(1);
  const titleOp = useSharedValue(0);
  const titleY = useSharedValue(24);
  const statsOp = useSharedValue(0);
  const statsY = useSharedValue(20);

  useEffect(() => {
    logoOp.value = withDelay(120, withTiming(1, { duration: 450 }));
    logoSc.value = withDelay(120, withSpring(1, { damping: 9, stiffness: 72 }));
    titleOp.value = withDelay(380, withTiming(1, { duration: 500 }));
    titleY.value = withDelay(380, withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }));
    statsOp.value = withDelay(600, withTiming(1, { duration: 450 }));
    statsY.value = withDelay(600, withTiming(0, { duration: 450, easing: Easing.out(Easing.cubic) }));
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

  const haloPos = (LOGO_WRAP_SIZE - 190) / 2;

  const PARTS = [
    { x: pageWidth * 0.08, y: 70, delay: 0, size: 4.5, color: '#f5a623' },
    { x: pageWidth * 0.85, y: 80, delay: 350, size: 3.5, color: '#38bdf8' },
    { x: pageWidth * 0.88, y: 260, delay: 700, size: 5, color: '#a855f7' },
    { x: pageWidth * 0.06, y: 320, delay: 250, size: 4, color: '#10b981' },
    { x: pageWidth * 0.80, y: 430, delay: 550, size: 3, color: '#f5a623' },
    { x: pageWidth * 0.12, y: 470, delay: 900, size: 4, color: '#f43f5e' },
  ];

  return (
    <View style={pg.root}>
      {/* Ambient background glows */}
      <View style={pg.blobA} />
      <View style={pg.blobB} />
      {PARTS.map((p, i) => (
        <Particle key={i} {...p} />
      ))}

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
            { top: haloPos, left: haloPos, width: 190, height: 190, borderRadius: 95 },
            aHalo,
          ]}
        />

        {/* 4 Concentric spinning rings */}
        <SpinRing size={230} delay={900} color="rgba(168,85,247,0.12)" speed={22000} reverse />
        <SpinRing size={206} delay={600} color="rgba(56,189,248,0.16)" speed={17000} />
        <SpinRing size={182} delay={300} color="rgba(255,255,255,0.10)" speed={13000} reverse />
        <SpinRing size={158} delay={0} color="rgba(245,166,35,0.38)" speed={9000} />

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

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 2 — FEATURES
// ─────────────────────────────────────────────────────────────────────────────
function PageFeatures({ lang, c }: { lang: LangKey; c: typeof COPY.en }) {
  return (
    <View style={p2.root}>
      <View style={p2.blobA} />
      <View style={p2.blobB} />

      {/* Header */}
      <View style={p2.header}>
        <View style={p2.badge}>
          <Ionicons name="grid" size={11} color="#f5a623" style={{ marginRight: 5 }} />
          <Text style={p2.badgeTxt}>OUR SERVICES</Text>
        </View>
        <Text style={p2.title}>{c.p2Title}</Text>
        <Text style={p2.sub}>{c.p2Sub}</Text>
      </View>

      {/* Feature rows */}
      <View style={p2.list}>
        {FEATURES.map((f, idx) => {
          const info = f[lang];
          return <FeatureRow key={f.id} f={f} info={info} idx={idx} />;
        })}
      </View>
    </View>
  );
}

function FeatureRow({
  f,
  info,
  idx,
}: {
  f: typeof FEATURES[0];
  info: any;
  idx: number;
}) {
  const op = useSharedValue(0);
  const tx = useSharedValue(-20);
  useEffect(() => {
    const d = idx * 80 + 150;
    op.value = withDelay(d, withTiming(1, { duration: 400 }));
    tx.value = withDelay(d, withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) }));
  }, []);
  const a = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ translateX: tx.value }],
  }));
  return (
    <Animated.View style={a}>
      <LinearGradient
        colors={[f.color + '18', 'rgba(255,255,255,0.03)']}
        style={[p2.row, { borderColor: f.color + '38' }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        {/* Icon */}
        <LinearGradient
          colors={[f.color + '32', f.color + '15']}
          style={p2.icon}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name={f.icon} size={18} color={f.color} />
        </LinearGradient>

        {/* Text */}
        <View style={p2.textCol}>
          <Text style={p2.rowTitle} numberOfLines={1}>
            {info.title}
          </Text>
          <Text style={p2.rowSub} numberOfLines={1}>
            {info.sub}
          </Text>
        </View>

        {/* Right side */}
        <View style={p2.rightCol}>
          <View style={[p2.rowBadge, { backgroundColor: f.color + '1e', borderColor: f.color + '45' }]}>
            <Text style={[p2.rowBadgeTxt, { color: f.color }]}>{info.badge}</Text>
          </View>
          <Text style={[p2.rowStat, { color: f.color }]}>{info.stat}</Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 3 — GET STARTED
// ─────────────────────────────────────────────────────────────────────────────
function PageGetStarted({
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
  const secOp = useSharedValue(0);
  const secY = useSharedValue(16);
  const btnOp = useSharedValue(0);
  const btnY = useSharedValue(14);
  useEffect(() => {
    secOp.value = withDelay(120, withTiming(1, { duration: 450 }));
    secY.value = withDelay(120, withTiming(0, { duration: 450, easing: Easing.out(Easing.cubic) }));
    btnOp.value = withDelay(350, withTiming(1, { duration: 450 }));
    btnY.value = withDelay(350, withTiming(0, { duration: 450, easing: Easing.out(Easing.cubic) }));
  }, []);
  const aSec = useAnimatedStyle(() => ({
    opacity: secOp.value,
    transform: [{ translateY: secY.value }],
  }));
  const aBtn = useAnimatedStyle(() => ({
    opacity: btnOp.value,
    transform: [{ translateY: btnY.value }],
  }));

  return (
    <View style={p3.root}>
      <View style={p3.blobA} />
      <View style={p3.blobB} />

      {/* Header */}
      <View style={p3.header}>
        <View style={p3.badge}>
          <Ionicons name="rocket" size={11} color="#f5a623" style={{ marginRight: 5 }} />
          <Text style={p3.badgeTxt}>GET STARTED</Text>
        </View>
        <Text style={p3.title}>{c.p3Title}</Text>
        <Text style={p3.sub}>{c.p3Sub}</Text>
      </View>

      {/* How it works */}
      <Animated.View style={[p3.stepsRow, aSec]}>
        {c.steps.map((label, i) => (
          <React.Fragment key={i}>
            <View style={p3.stepItem}>
              <LinearGradient
                colors={['#f5a623', '#c77d10']}
                style={p3.stepNum}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={p3.stepNumTxt}>{i + 1}</Text>
              </LinearGradient>
              <View style={p3.stepIconBox}>
                <Ionicons name={c.stepIcons[i]} size={20} color="#f5a623" />
              </View>
              <Text style={p3.stepLabel}>{label}</Text>
            </View>
            {i < 2 && (
              <View style={p3.stepArrow}>
                <Ionicons name="chevron-forward" size={14} color="rgba(245,166,35,0.45)" />
              </View>
            )}
          </React.Fragment>
        ))}
      </Animated.View>

      {/* Network badges */}
      <Animated.View style={[p3.netsBlock, aSec]}>
        <Text style={p3.netsTitle}>{c.networks}</Text>
        <View style={p3.netsRow}>
          {NETWORKS.map(n => (
            <View
              key={n.name}
              style={[p3.netChip, { backgroundColor: n.bg, borderColor: n.color + '55' }]}
            >
              <View style={[p3.netDot, { backgroundColor: n.color }]} />
              <Text style={[p3.netTxt, { color: n.color }]}>{n.name}</Text>
            </View>
          ))}
        </View>
      </Animated.View>

      {/* Notification preview card */}
      <Animated.View style={aSec}>
        <LinearGradient
          colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']}
          style={p3.notifCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={p3.notifIcon}>
            <LinearGradient
              colors={['#10b981', '#059669']}
              style={{ flex: 1, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="checkmark-circle" size={16} color="#ffffff" />
            </LinearGradient>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={p3.notifTitle}>{c.notifTitle}</Text>
            <Text style={p3.notifBody}>{c.notifBody}</Text>
          </View>
          <View style={{ alignItems: 'center', gap: 3 }}>
            <View style={p3.notifDot} />
            <Text style={p3.notifNow}>now</Text>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* CTA Buttons */}
      <Animated.View style={[p3.btnBlock, aBtn]}>
        {checking ? (
          <View style={p3.loadCard}>
            <ActivityIndicator size="small" color="#f5a623" />
            <Text style={p3.loadTxt}>{c.verify}</Text>
          </View>
        ) : (
          <View style={{ gap: 9 }}>
            <TouchableOpacity
              onPress={() => {
                haptic();
                router.push('/(auth)/login');
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
                <Ionicons name="person" size={15} color="#010812" />
                <Text style={p3.primaryTxt}>{c.signin}</Text>
                <View style={p3.arrow}>
                  <Ionicons name="arrow-forward" size={12} color="#010812" />
                </View>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                haptic();
                router.push('/(auth)/signup');
              }}
              activeOpacity={0.8}
              style={p3.secondaryBtn}
            >
              <Ionicons name="person-add-outline" size={14} color="#dde4ef" style={{ marginRight: 6 }} />
              <Text style={p3.secondaryTxt}>{c.signup}</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>

      {/* SSL Footnote */}
      <View style={p3.sslRow}>
        <Ionicons name="shield-checkmark" size={10} color="#10b981" />
        <Text style={p3.sslTxt}>{c.ssl}</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function SplashScreen() {
  const router = useRouter();
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const [checking, setChecking] = useState(true);
  const [lang, setLang] = useState<LangKey>('en');
  const [pageIdx, setPageIdx] = useState(0);
  const flatRef = useRef<FlatList>(null);
  const PAGE_COLORS = ['#f5a623', '#38bdf8', '#10b981'];

  // Responsive page width: phone uses 100%, desktop web caps at 440px
  const PAGE_W = winWidth > 480 ? 440 : winWidth;
  const NAV_H = Platform.OS === 'ios' ? 84 : 74;

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
    flatRef.current?.scrollToIndex({ index: idx, animated: true });
    setPageIdx(idx);
  };

  const goNext = () => {
    const next = Math.min(pageIdx + 1, 2);
    goToPage(next);
  };

  const goSkip = () => {
    goToPage(2);
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setPageIdx(viewableItems[0].index);
    }
  });
  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 });

  const c = COPY[lang];
  const pages = [
    {
      key: 'welcome',
      el: <PageWelcome c={c} lang={lang} setLang={setLang} haptic={haptic} pageWidth={PAGE_W} />,
    },
    { key: 'features', el: <PageFeatures lang={lang} c={c} /> },
    {
      key: 'start',
      el: <PageGetStarted c={c} checking={checking} router={router} haptic={haptic} />,
    },
  ];

  return (
    <View style={root.outerScreen}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Deep luxury cosmic background */}
      <LinearGradient
        colors={['#010812', '#050f28', '#091a48', '#050f28', '#010812']}
        locations={[0, 0.22, 0.5, 0.78, 1]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
      />

      {/* Main phone frame: centered on desktop web, edge-to-edge on mobile */}
      <View
        style={[
          root.appFrame,
          {
            width: PAGE_W,
            ...(Platform.OS === 'web' && winWidth > 480
              ? {
                  borderRadius: 32,
                  marginVertical: Math.max(16, (winHeight - 840) / 2),
                  height: Math.min(winHeight - 32, 820),
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.12)',
                  shadowColor: '#000000',
                  shadowOffset: { width: 0, height: 20 },
                  shadowOpacity: 0.85,
                  shadowRadius: 40,
                  elevation: 25,
                }
              : {}),
          },
        ]}
      >
        {/* FlatList horizontal paging */}
        <FlatList
          ref={flatRef}
          data={pages}
          keyExtractor={item => item.key}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          getItemLayout={(_, index) => ({
            length: PAGE_W,
            offset: PAGE_W * index,
            index,
          })}
          onViewableItemsChanged={onViewableItemsChanged.current}
          viewabilityConfig={viewabilityConfig.current}
          style={{ flex: 1 }}
          renderItem={({ item }) => (
            <View style={{ width: PAGE_W, flex: 1 }}>
              <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                {item.el}
              </SafeAreaView>
            </View>
          )}
        />

        {/* Navigation bar at bottom of frame */}
        <View style={[root.navBar, { height: NAV_H }]}>
          {/* Dot indicators */}
          <View style={root.dots}>
            {pages.map((_, i) => (
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
                <Text style={root.backTxt}>Back to start</Text>
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
    backgroundColor: '#010812',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appFrame: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#010812',
  },
  navBar: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 18 : 12,
    paddingTop: 8,
    backgroundColor: 'rgba(1,8,18,0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 4,
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
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 10,
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

  // Logo wrapper: Fixed 240×240 box
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
    width: 140,
    height: 140,
    borderRadius: 70,
    padding: 3.5,
    shadowColor: '#f5a623',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
    elevation: 18,
  },
  medalGrad: {
    flex: 1,
    borderRadius: 67,
    padding: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medalInner: {
    width: '100%',
    height: '100%',
    borderRadius: 65,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImg: {
    width: 124,
    height: 124,
  },
  vBadge: {
    position: 'absolute',
    bottom: 22,
    right: 18,
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
    top: 22,
    right: 18,
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
    marginBottom: 7,
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
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    justifyContent: 'space-between',
  },
  blobA: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(56,189,248,0.08)',
  },
  blobB: {
    position: 'absolute',
    bottom: 20,
    left: -30,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(168,85,247,0.07)',
  },

  header: {
    marginBottom: 8,
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
    marginBottom: 6,
  },
  badgeTxt: {
    color: '#f5a623',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 1.3,
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  sub: {
    color: '#8ea4c4',
    fontSize: 11,
    fontWeight: '500',
  },

  list: {
    flex: 1,
    justifyContent: 'space-evenly',
    gap: 7,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 13,
    borderWidth: 1.1,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textCol: {
    flex: 1,
  },
  rowTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 1,
  },
  rowSub: {
    color: '#8ea4c4',
    fontSize: 9.5,
  },
  rightCol: {
    alignItems: 'flex-end',
    gap: 3,
    flexShrink: 0,
  },
  rowBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
    borderWidth: 1,
  },
  rowBadgeTxt: {
    fontSize: 7.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  rowStat: {
    fontSize: 10,
    fontWeight: '900',
  },
});

// ─── Page 3: Get Started ─────────────────────────────────────────────────────
const p3 = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 6,
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
    marginBottom: 6,
  },
  badgeTxt: {
    color: '#f5a623',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 1.3,
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  sub: {
    color: '#8ea4c4',
    fontSize: 11,
    fontWeight: '500',
  },

  // Steps
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumTxt: {
    color: '#010812',
    fontSize: 11,
    fontWeight: '900',
  },
  stepIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(245,166,35,0.1)',
    borderWidth: 1.2,
    borderColor: 'rgba(245,166,35,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    color: '#94a3b8',
    fontSize: 9.5,
    textAlign: 'center',
    fontWeight: '700',
    lineHeight: 13,
    maxWidth: 75,
  },
  stepArrow: {
    paddingTop: 36,
  },

  // Networks
  netsBlock: {},
  netsTitle: {
    color: '#64748b',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 1.4,
    textAlign: 'center',
    marginBottom: 6,
  },
  netsRow: {
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  netChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
    paddingHorizontal: 10,
    paddingVertical: 5.5,
    borderRadius: 10,
    borderWidth: 1,
  },
  netDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  netTxt: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.3,
  },

  // Notif preview
  notifCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 10,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  notifIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  notifTitle: {
    color: '#f0f4ff',
    fontSize: 11.5,
    fontWeight: '800',
    marginBottom: 1.5,
  },
  notifBody: {
    color: '#8ea4c4',
    fontSize: 9.5,
  },
  notifDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10b981',
  },
  notifNow: {
    color: '#10b981',
    fontSize: 8.5,
    fontWeight: '800',
  },

  // Buttons
  btnBlock: {},
  loadCard: {
    flexDirection: 'row',
    alignItems: 'center',
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
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.42,
    shadowRadius: 12,
    elevation: 10,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  primaryTxt: {
    color: '#010812',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  arrow: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(1,8,18,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  secondaryTxt: {
    color: '#dde4ef',
    fontSize: 12.5,
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
    color: '#475569',
    fontSize: 9,
    fontWeight: '600',
  },
});
