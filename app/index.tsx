import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  Platform,
  StatusBar,
  ActivityIndicator,
  Linking,
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
  withDelay,
  Easing,
  interpolate,
  useAnimatedProps,
} from 'react-native-reanimated';
import { supabase, processOAuthReturn } from '../services/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: W, height: H } = Dimensions.get('window');

type LangKey = 'en' | 'ha';

// ─── COPY ─────────────────────────────────────────────────────────────────────
const COPY = {
  en: {
    live: 'LIVE · 99.98% UPTIME',   lang: '🇳🇬 HA',
    motto: 'TRUST  ·  QUALITY  ·  VALUE',
    brand: 'ABU MAFHAL',            sub: 'SUB',
    tagline: 'Premium Automated Telecom & Smart Financial Hub',
    promo: '🔥  Special Offer — Extra 5% Cashback on Data Bundles Today!',
    signin: 'Sign In to Account',   signup: 'Create Free Account',
    tour: 'Explore Features',       whatsapp: '24/7 Support',
    verify: 'Verifying Secure Session',
    connecting: 'Connecting to Abu Mafhal Gateway...',
    ssl: 'Bank-Grade 256-Bit SSL · NDPA Protected',
    version: 'Abu Mafhal Hub · v1.0.1',
    processed: 'Processed',         resellers: 'Resellers',   uptime: 'Uptime',
    steps: ['Top-Up Wallet', 'Choose Service', 'Instant Delivery'],
    stepIcons: ['wallet-outline', 'grid-outline', 'checkmark-done-circle-outline'] as const,
    notif: { title: 'Purchase Successful!', body: '₦1,000 MTN Airtime — delivered instantly', time: 'now' },
    trusted: 'Trusted by 50,000+ Resellers',
  },
  ha: {
    live: 'TSARIN YA AIKI · 99.98%', lang: '🇬🇧 EN',
    motto: 'AMINCI  ·  INGANCI  ·  DARAJAR',
    brand: 'ABU MAFHAL',             sub: 'SUB',
    tagline: 'Babban Dandalin Sayen Data, Katin Waya da Biyan Kudi',
    promo: '🔥  Musamman — Karin Cashback 5% a Duk Data Bundles Yau!',
    signin: 'Shiga Cikin Asusu',     signup: 'Bude Sabon Asusu',
    tour: 'Kalli Ayyukan App',       whatsapp: 'Taimako 24/7',
    verify: 'Ana Duba Asusu...',
    connecting: 'Ana Hadawa da Gateway...',
    ssl: 'Tsaro na Banki · An Kare Bayananku',
    version: 'Abu Mafhal Hub · v1.0.1',
    processed: 'An Sarrafa',         resellers: 'Masu Amfani',  uptime: 'Nasarar Aiki',
    steps: ['Cika Wallet', 'Zabi Sabis', 'Karba Nan Take'],
    stepIcons: ['wallet-outline', 'grid-outline', 'checkmark-done-circle-outline'] as const,
    notif: { title: 'An Yi Cinikin!', body: 'Katin MTN N1,000 — an tura nan take', time: 'yanzu' },
    trusted: 'Amintacce ga Masu Amfani 50,000+',
  },
};

// ─── FEATURE DATA ─────────────────────────────────────────────────────────────
const FEN = [
  { id: 'data',     icon: 'wifi'    as const, color: '#38bdf8', badge: 'FROM ₦215/GB',    title: '5G High-Speed Data',          subtitle: 'SME, Corporate & Gifting bundles for MTN, Airtel, Glo & 9mobile — 3-second delivery guaranteed.', stat: '₦215/GB',   tag: 'BEST SELLER' },
  { id: 'airtime',  icon: 'flash'   as const, color: '#f5a623', badge: 'UP TO 3% CASHBACK', title: 'Instant Airtime VTU',        subtitle: 'Automated VTU for all Nigerian networks with real-time cashback credited to your wallet instantly.', stat: '3% Back',   tag: 'POPULAR' },
  { id: 'bills',    icon: 'bulb'    as const, color: '#10b981', badge: 'INSTANT TOKEN',    title: 'Electricity & Cable TV',      subtitle: 'Prepaid meter tokens for IKEDC, AEDC, EKEDC & DStv, GOtv, Startimes subscription renewal.', stat: '< 5 Secs',  tag: 'INSTANT' },
  { id: 'wallet',   icon: 'card'    as const, color: '#a855f7', badge: 'AUTO-CREDIT',      title: 'Dedicated Virtual Accounts',  subtitle: 'Personal bank accounts from Moniepoint, Wema & Sterling with 0-second automatic wallet funding.', stat: '0-Second', tag: 'FREE' },
  { id: 'cashback', icon: 'gift'    as const, color: '#f43f5e', badge: 'DAILY INCOME',     title: 'Earn & Reseller Profits',     subtitle: 'Earn continuous cashback on every purchase plus lucrative commissions from sharing your link.', stat: 'Daily ₦₦',  tag: 'EARN' },
];
const FHA = [
  { id: 'data',     icon: 'wifi'    as const, color: '#38bdf8', badge: 'DAGA ₦215/GB',    title: 'Ingantacciyar Data Mai Sauri',badge: 'DAGA ₦215/GB',   subtitle: 'Sayen data na SME, Gifting, Corporate na MTN, Airtel, Glo da 9mobile cikin dakika 3.', stat: '₦215/GB',  tag: 'MAFI KYAU' },
  { id: 'airtime',  icon: 'flash'   as const, color: '#f5a623', badge: 'RAGIN 3%',         title: 'Sayen Katin Waya',           badge: 'RAGIN 3%',        subtitle: 'Tura katin waya nan take zuwa kowace layi a Najeriya tare da cashback kai tsaye.', stat: '3% Ragi',  tag: 'SANANNEN' },
  { id: 'bills',    icon: 'bulb'    as const, color: '#10b981', badge: 'TOKEN NAN TAKE',   title: 'Biyan Wutar Lantarki da TV', badge: 'TOKEN NAN TAKE',  subtitle: 'Samo lambar wuta (token) da biyan kudin kallo na DStv, GOtv da Startimes cikin sakan 5.', stat: '< 5 Sak.', tag: 'NAN TAKE' },
  { id: 'wallet',   icon: 'card'    as const, color: '#a855f7', badge: 'KUDI NAN TAKE',    title: 'Asusun Banki na Musamman',   badge: 'KUDI NAN TAKE',   subtitle: 'Sanya kudi a wallet dinka ta Moniepoint, Wema da Sterling Bank ba jinkiri.', stat: '0-Sakan',  tag: 'KYAUTA' },
  { id: 'cashback', icon: 'gift'    as const, color: '#f43f5e', badge: 'KARIN KUDI',       title: 'Samun Riba da Garabasa',     badge: 'KARIN KUDI',      subtitle: 'Sami cashback a kowane sayi tare da samun alawus idan ka gayyato abokanka.', stat: 'Riba Kullum', tag: 'SAMU' },
];
const FEATURES = { en: FEN, ha: FHA };

// ─── NETWORKS STRIP ───────────────────────────────────────────────────────────
const NETWORKS = [
  { name: 'MTN',     color: '#f5c518', bg: '#1a1400' },
  { name: 'Airtel',  color: '#ff1c1c', bg: '#1a0000' },
  { name: 'Glo',     color: '#22c55e', bg: '#001a07' },
  { name: '9mobile', color: '#a3e635', bg: '#0d1a00' },
];

// ─── FLOATING PARTICLE ────────────────────────────────────────────────────────
interface PProps { x: number; y: number; delay: number; size: number; color: string; }
function Particle({ x, y, delay, size, color }: PProps) {
  const op = useSharedValue(0), ty = useSharedValue(0), sc = useSharedValue(0.4);
  useEffect(() => {
    op.value = withDelay(delay, withRepeat(withSequence(withTiming(0.9, { duration: 1200 }), withTiming(0, { duration: 1200 })), -1, false));
    ty.value = withDelay(delay, withRepeat(withTiming(-50, { duration: 2600, easing: Easing.inOut(Easing.ease) }), -1, true));
    sc.value = withDelay(delay, withRepeat(withSequence(withTiming(1.3, { duration: 1200 }), withTiming(0.4, { duration: 1200 })), -1, false));
  }, []);
  const a = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ translateY: ty.value }, { scale: sc.value }] }));
  return <Animated.View style={[{ position: 'absolute', left: x, top: y, width: size, height: size, borderRadius: size / 2, backgroundColor: color }, a]} />;
}

// ─── SPINNING RING ────────────────────────────────────────────────────────────
function SpinRing({ size, delay, color, speed, reverse }: { size: number; delay: number; color: string; speed: number; reverse?: boolean }) {
  const r = useSharedValue(0), op = useSharedValue(0);
  useEffect(() => {
    op.value = withDelay(delay, withTiming(1, { duration: 800 }));
    r.value = withRepeat(withTiming(reverse ? -360 : 360, { duration: speed, easing: Easing.linear }), -1, false);
  }, []);
  const a = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ rotate: `${r.value}deg` }] }));
  return <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 1.2, borderColor: color, borderStyle: 'dashed' }, a]} />;
}

// ─── SHIMMER BEAM ─────────────────────────────────────────────────────────────
function ShimmerBeam() {
  const tx = useSharedValue(-160);
  useEffect(() => {
    tx.value = withRepeat(withSequence(withTiming(160, { duration: 1800, easing: Easing.inOut(Easing.ease) }), withTiming(-160, { duration: 100 }), withDelay(2400, withTiming(-160, { duration: 0 }))), -1, false);
  }, []);
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { rotate: '25deg' }] }));
  return (
    <Animated.View style={[{ position: 'absolute', width: 50, height: 180, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 30, overflow: 'hidden' }, a]} />
  );
}

// ─── STAT BOX WITH COUNTER ────────────────────────────────────────────────────
function StatBox({ value, label, delay }: { value: string; label: string; delay: number }) {
  const sc = useSharedValue(0.6), op = useSharedValue(0), brd = useSharedValue(0);
  useEffect(() => {
    sc.value = withDelay(delay, withSpring(1, { damping: 10, stiffness: 85 }));
    op.value = withDelay(delay, withTiming(1, { duration: 500 }));
    brd.value = withDelay(delay + 200, withTiming(1, { duration: 600 }));
  }, []);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }], opacity: op.value }));
  return (
    <Animated.View style={[{ alignItems: 'center', flex: 1 }, a]}>
      <Text style={s.statNum}>{value}</Text>
      <Text style={s.statLbl}>{label}</Text>
    </Animated.View>
  );
}

// ─── STEP ITEM ────────────────────────────────────────────────────────────────
function StepItem({ num, icon, label, delay }: { num: number; icon: keyof typeof Ionicons.glyphMap; label: string; delay: number }) {
  const op = useSharedValue(0), ty = useSharedValue(20);
  useEffect(() => {
    op.value = withDelay(delay, withTiming(1, { duration: 500 }));
    ty.value = withDelay(delay, withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }));
  }, []);
  const a = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ translateY: ty.value }] }));
  return (
    <Animated.View style={[s.stepItem, a]}>
      <View style={s.stepCircle}>
        <Text style={s.stepNum}>{num}</Text>
      </View>
      <View style={s.stepIconCircle}>
        <Ionicons name={icon} size={16} color="#f5a623" />
      </View>
      <Text style={s.stepLabel} numberOfLines={2}>{label}</Text>
    </Animated.View>
  );
}

// ─── NOTIFICATION PREVIEW CARD ────────────────────────────────────────────────
function NotifCard({ title, body, time, delay }: { title: string; body: string; time: string; delay: number }) {
  const op = useSharedValue(0), ty = useSharedValue(-16), sc = useSharedValue(0.92);
  useEffect(() => {
    op.value = withDelay(delay, withTiming(1, { duration: 600 }));
    ty.value = withDelay(delay, withTiming(0, { duration: 600, easing: Easing.out(Easing.back(1.1)) }));
    sc.value = withDelay(delay, withSpring(1, { damping: 11, stiffness: 90 }));
  }, []);
  const a = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ translateY: ty.value }, { scale: sc.value }] }));
  return (
    <Animated.View style={a}>
      <LinearGradient colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.04)']} style={s.notifCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={s.notifIcon}>
          <LinearGradient colors={['#f5a623', '#c77d10']} style={{ flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Ionicons name="checkmark-circle" size={16} color="#020910" />
          </LinearGradient>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.notifTitle}>{title}</Text>
          <Text style={s.notifBody} numberOfLines={1}>{body}</Text>
        </View>
        <View style={s.notifTimeWrap}>
          <Text style={s.notifTime}>{time}</Text>
          <View style={s.notifDot} />
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

// ─── FEATURE PILL ─────────────────────────────────────────────────────────────
function FeaturePill({ item, isActive, onPress }: { item: typeof FEN[0]; isActive: boolean; onPress: () => void }) {
  const sc = useSharedValue(1), op = useSharedValue(isActive ? 1 : 0.5);
  useEffect(() => {
    op.value = withTiming(isActive ? 1 : 0.5, { duration: 300 });
    if (isActive) sc.value = withSequence(withTiming(1.07, { duration: 130 }), withSpring(1));
  }, [isActive]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }], opacity: op.value }));
  const LABELS: Record<string, string> = { data: 'Data', airtime: 'Airtime', bills: 'Bills', wallet: 'Wallet', cashback: 'Earn' };
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.78} style={{ flex: 1 }}>
      <Animated.View style={[s.pill, a, isActive && { borderColor: item.color, borderWidth: 1.5, backgroundColor: item.color + '16' }]}>
        <View style={[s.pillIco, { backgroundColor: item.color + '24' }]}>
          <Ionicons name={item.icon} size={12} color={item.color} />
        </View>
        <Text style={[s.pillTxt, isActive && { color: '#fff', fontWeight: '700' }]} numberOfLines={1}>
          {LABELS[item.id] || item.id}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── AURORA ORB ───────────────────────────────────────────────────────────────
function AuroraOrb({ style, delay }: { style: any; delay: number }) {
  const sc = useSharedValue(0.9), op = useSharedValue(0.6);
  useEffect(() => {
    sc.value = withDelay(delay, withRepeat(withSequence(withTiming(1.18, { duration: 4000, easing: Easing.inOut(Easing.ease) }), withTiming(0.9, { duration: 4000, easing: Easing.inOut(Easing.ease) })), -1, false));
    op.value = withDelay(delay, withRepeat(withSequence(withTiming(0.85, { duration: 3500, easing: Easing.inOut(Easing.ease) }), withTiming(0.5, { duration: 3500, easing: Easing.inOut(Easing.ease) })), -1, false));
  }, []);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }], opacity: op.value }));
  return <Animated.View style={[style, a]} />;
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function SplashScreen() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [lang, setLang] = useState<LangKey>('en');
  const [activeIdx, setActiveIdx] = useState(0);

  // Entrance animations
  const hOp = useSharedValue(0), hY = useSharedValue(-30);
  const lOp = useSharedValue(0), lSc = useSharedValue(0);
  const tOp = useSharedValue(0), tY = useSharedValue(38);
  const cOp = useSharedValue(0), cY = useSharedValue(54);
  const sOp = useSharedValue(0), sY = useSharedValue(46);
  const bOp = useSharedValue(0), bY = useSharedValue(62);
  const fOp = useSharedValue(0);
  const halo = useSharedValue(1);
  const orbY = useSharedValue(0);
  const ctOp = useSharedValue(1), ctY = useSharedValue(0);
  const promoX = useSharedValue(W);
  const starsW = useSharedValue(0);

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);
    const T = (v: number, d: number, dl?: number) => dl ? withDelay(dl, withTiming(v, { duration: d, easing: ease })) : withTiming(v, { duration: d, easing: ease });
    hOp.value = T(1, 500, 60);   hY.value  = withDelay(60,  withTiming(0, { duration: 560, easing: Easing.out(Easing.back(1.1)) }));
    lOp.value = T(1, 450, 200);  lSc.value = withDelay(200, withSpring(1, { damping: 9, stiffness: 75 }));
    tOp.value = T(1, 560, 400);  tY.value  = T(0, 560, 400);
    cOp.value = T(1, 560, 570);  cY.value  = T(0, 560, 570);
    sOp.value = T(1, 480, 730);  sY.value  = T(0, 480, 730);
    bOp.value = T(1, 500, 880);  bY.value  = T(0, 500, 880);
    fOp.value = T(1, 450, 1060);
    halo.value = withRepeat(withSequence(withTiming(1.14, { duration: 2200, easing: Easing.inOut(Easing.ease) }), withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) })), -1, false);
    orbY.value = withRepeat(withSequence(withTiming(22, { duration: 3400, easing: Easing.inOut(Easing.ease) }), withTiming(0, { duration: 3400, easing: Easing.inOut(Easing.ease) })), -1, false);
    promoX.value = withDelay(1200, withRepeat(withSequence(withTiming(-W * 1.2, { duration: 14000, easing: Easing.linear }), withTiming(W, { duration: 0 })), -1, false));
    starsW.value = withDelay(1400, withTiming(80, { duration: 800, easing: Easing.out(Easing.cubic) }));
    checkAuthSession();
  }, []);

  useEffect(() => {
    const t = setInterval(() => setActiveIdx(p => (p + 1) % FEN.length), 4200);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    ctOp.value = withSequence(withTiming(0.1, { duration: 170 }), withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }));
    ctY.value  = withSequence(withTiming(16, { duration: 170 }), withTiming(0, { duration: 320, easing: Easing.out(Easing.back(1.25)) }));
  }, [activeIdx]);

  const checkAuthSession = async () => {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const search = window.location.search || '', hash = window.location.hash || '';
        const hasAuth = (hash && hash.includes('access_token')) || (search && search.includes('code='));
        if (hasAuth) {
          const ua = (window.navigator?.userAgent || '').toLowerCase();
          if (/android|iphone|ipad|ipod/.test(ua)) { window.location.href = `abumafhalsub://login${search}${hash}`; router.replace('/auth/callback' as any); return; }
          await processOAuthReturn();
        }
      }
      const { data: { session } } = await supabase.auth.getSession();
      const unlocked = await AsyncStorage.getItem('app_unlocked');
      if (session?.user) {
        setTimeout(() => router.replace(unlocked === 'true' ? '/dashboard' as any : '/pin' as any), 600);
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
    if (Platform.OS !== 'web') { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {} }
  }, []);

  const aH   = useAnimatedStyle(() => ({ opacity: hOp.value, transform: [{ translateY: hY.value }] }));
  const aL   = useAnimatedStyle(() => ({ opacity: lOp.value, transform: [{ scale: lSc.value }] }));
  const aHalo= useAnimatedStyle(() => ({ transform: [{ scale: halo.value }] }));
  const aOT  = useAnimatedStyle(() => ({ transform: [{ translateY: orbY.value }] }));
  const aOB  = useAnimatedStyle(() => ({ transform: [{ translateY: -orbY.value }] }));
  const aT   = useAnimatedStyle(() => ({ opacity: tOp.value, transform: [{ translateY: tY.value }] }));
  const aC   = useAnimatedStyle(() => ({ opacity: cOp.value, transform: [{ translateY: cY.value }] }));
  const aCT  = useAnimatedStyle(() => ({ opacity: ctOp.value, transform: [{ translateY: ctY.value }] }));
  const aS   = useAnimatedStyle(() => ({ opacity: sOp.value, transform: [{ translateY: sY.value }] }));
  const aB   = useAnimatedStyle(() => ({ opacity: bOp.value, transform: [{ translateY: bY.value }] }));
  const aF   = useAnimatedStyle(() => ({ opacity: fOp.value }));
  const aPromo = useAnimatedStyle(() => ({ transform: [{ translateX: promoX.value }] }));
  const aStars = useAnimatedStyle(() => ({ width: starsW.value, overflow: 'hidden' }));

  const c = COPY[lang];
  const features = FEATURES[lang];
  const feat = features[activeIdx];

  const PARTICLES: PProps[] = [
    { x: W*0.05, y: H*0.13, delay: 0,    size: 4.5, color: '#f5a623' },
    { x: W*0.88, y: H*0.10, delay: 350,  size: 3,   color: '#38bdf8' },
    { x: W*0.94, y: H*0.50, delay: 700,  size: 5,   color: '#a855f7' },
    { x: W*0.02, y: H*0.63, delay: 250,  size: 4,   color: '#10b981' },
    { x: W*0.78, y: H*0.79, delay: 550,  size: 3.5, color: '#f5a623' },
    { x: W*0.11, y: H*0.85, delay: 900,  size: 4,   color: '#f43f5e' },
    { x: W*0.52, y: H*0.06, delay: 180,  size: 3,   color: '#38bdf8' },
    { x: W*0.42, y: H*0.95, delay: 650,  size: 5,   color: '#a855f7' },
    { x: W*0.65, y: H*0.22, delay: 430,  size: 3,   color: '#f43f5e' },
    { x: W*0.25, y: H*0.44, delay: 820,  size: 3.5, color: '#f5a623' },
  ];

  const ICON_STRIP = [
    { icon: 'wifi' as const,  color: '#38bdf8', label: 'Data' },
    { icon: 'flash' as const, color: '#f5a623', label: 'VTU' },
    { icon: 'bulb' as const,  color: '#10b981', label: 'Bills' },
    { icon: 'card' as const,  color: '#a855f7', label: 'Wallet' },
    { icon: 'gift' as const,  color: '#f43f5e', label: 'Earn' },
  ];

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ─── Deep multi-stop cosmic gradient ─── */}
      <LinearGradient
        colors={['#010812', '#040f26', '#081a48', '#040f26', '#010812']}
        locations={[0, 0.22, 0.5, 0.78, 1]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }}
      />

      {/* ─── Aurora orbs ─── */}
      <AuroraOrb style={s.aurA} delay={0} />
      <AuroraOrb style={s.aurB} delay={1500} />
      <AuroraOrb style={s.aurC} delay={800} />
      <Animated.View style={[s.orbA, { transform: [{ translateY: orbY.value }] }]} />
      <Animated.View style={[s.orbB, { transform: [{ translateY: interpolate(orbY.value, [0, 22], [0, -22]) }] }]} />

      {/* ─── Particle Field ─── */}
      {PARTICLES.map((p, i) => <Particle key={i} {...p} />)}

      {/* ─── Fine dot grid ─── */}
      <View style={s.gridDots} />

      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} bounces={false}>

          {/* ══════ HEADER ══════ */}
          <Animated.View style={[s.topBar, aH]}>
            <View style={s.livePill}>
              <View style={s.liveDot} />
              <Text style={s.liveTxt}>{c.live}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <TouchableOpacity onPress={() => { haptic(); setLang(l => l === 'en' ? 'ha' : 'en'); }} style={s.langBtn} activeOpacity={0.8}>
                <Text style={s.langTxt}>{c.lang}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => Linking.openURL('https://wa.me/2348144445438?text=Hello%20Abu%20Mafhal%20Support')}
                style={s.waBtn} activeOpacity={0.8}
              >
                <Ionicons name="logo-whatsapp" size={13} color="#25D366" />
                <Text style={s.waTxt}>{c.whatsapp}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* ══════ PROMO TICKER ══════ */}
          <View style={s.tickerWrap}>
            <LinearGradient colors={['rgba(245,166,35,0.18)', 'rgba(245,166,35,0.06)', 'rgba(245,166,35,0.18)']} style={s.tickerBar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Animated.Text style={[s.tickerTxt, aPromo]}>{c.promo}</Animated.Text>
            </LinearGradient>
          </View>

          {/* ══════ LOGO MEDALLION ══════ */}
          <Animated.View style={[s.logoArea, aL]}>
            {/* Breathing halo */}
            <Animated.View style={[s.haloGlow, aHalo]} />
            {/* Spinning rings */}
            <SpinRing size={196} delay={0}    color="rgba(245,166,35,0.34)"  speed={9500} />
            <SpinRing size={172} delay={350}  color="rgba(255,255,255,0.09)" speed={13500} reverse />
            <SpinRing size={218} delay={700}  color="rgba(56,189,248,0.15)"  speed={17500} />
            <SpinRing size={240} delay={1000} color="rgba(168,85,247,0.10)"  speed={22000} reverse />
            {/* Gold bevel medallion */}
            <View style={s.medallion}>
              <LinearGradient colors={['#ffe566', '#f5a623', '#b87015', '#f5a623', '#ffe566']} locations={[0, 0.2, 0.5, 0.8, 1]} style={s.medalGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <View style={s.medalInner}>
                  {/* Shimmer beam over logo */}
                  <ShimmerBeam />
                  <Image source={require('../assets/images/logo.png')} style={s.logoImg} resizeMode="contain" />
                </View>
              </LinearGradient>
            </View>
            {/* Verified badge */}
            <View style={s.vBadge}>
              <LinearGradient colors={['#f5a623', '#c77d10']} style={s.vBadgeIn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Ionicons name="checkmark" size={9} color="#010812" />
              </LinearGradient>
            </View>
            {/* Star badge top right */}
            <View style={s.starBadge}>
              <Ionicons name="star" size={9} color="#010812" />
            </View>
          </Animated.View>

          {/* ══════ BRAND BLOCK ══════ */}
          <Animated.View style={[s.brandBlock, aT]}>
            {/* Motto ribbon */}
            <View style={s.mottoRow}>
              <View style={s.mottoDash} />
              <View style={s.mottoPill}>
                <Ionicons name="shield-checkmark" size={10} color="#f5a623" style={{ marginRight: 4 }} />
                <Text style={s.mottoTxt}>{c.motto}</Text>
              </View>
              <View style={s.mottoDash} />
            </View>

            {/* Brand name */}
            <View style={s.brandRow}>
              <Text style={s.brandName}>{c.brand}</Text>
              <LinearGradient colors={['#f5a623', '#c77d10']} style={s.subChip} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Text style={s.subTxt}>{c.sub}</Text>
              </LinearGradient>
            </View>

            <Text style={s.tagline}>{c.tagline}</Text>

            {/* Star rating + trusted */}
            <View style={s.trustRow}>
              <Animated.View style={[s.starsClip, aStars]}>
                <Text style={s.stars}>★★★★★</Text>
              </Animated.View>
              <Text style={s.trustedTxt}>{c.trusted}</Text>
            </View>

            {/* Icon service strip */}
            <View style={s.iconStrip}>
              {ICON_STRIP.map(it => (
                <View key={it.icon} style={s.iconStripItem}>
                  <LinearGradient colors={[it.color + '28', it.color + '10']} style={s.iconCircle} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <Ionicons name={it.icon} size={13} color={it.color} />
                  </LinearGradient>
                  <Text style={[s.iconLbl, { color: it.color }]}>{it.label}</Text>
                </View>
              ))}
            </View>

            {/* Network operator strip */}
            <View style={s.netRow}>
              {NETWORKS.map(n => (
                <View key={n.name} style={[s.netChip, { backgroundColor: n.bg, borderColor: n.color + '55' }]}>
                  <Text style={[s.netTxt, { color: n.color }]}>{n.name}</Text>
                </View>
              ))}
              <View style={s.netMore}>
                <Text style={s.netMoreTxt}>& more</Text>
              </View>
            </View>
          </Animated.View>

          {/* ══════ HOW IT WORKS ══════ */}
          <Animated.View style={[s.stepsWrap, aC]}>
            <LinearGradient colors={['rgba(245,166,35,0.08)', 'rgba(255,255,255,0.03)', 'rgba(245,166,35,0.06)']} style={s.stepsCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <View style={s.stepsHeader}>
                <View style={s.stepsDot} />
                <Text style={s.stepsTitle}>HOW IT WORKS</Text>
                <View style={s.stepsDot} />
              </View>
              <View style={s.stepsRow}>
                {c.steps.map((label, i) => (
                  <React.Fragment key={i}>
                    <StepItem num={i + 1} icon={c.stepIcons[i]} label={label} delay={680 + i * 120} />
                    {i < 2 && <View style={s.stepArrow}><Ionicons name="chevron-forward" size={12} color="rgba(245,166,35,0.4)" /></View>}
                  </React.Fragment>
                ))}
              </View>
            </LinearGradient>
          </Animated.View>

          {/* ══════ FEATURE SHOWCASE ══════ */}
          <Animated.View style={[s.showcaseWrap, { opacity: cOp.value }]}>
            {/* Pills */}
            <View style={s.pillRow}>
              {features.map((f, i) => (
                <FeaturePill key={f.id} item={f} isActive={activeIdx === i} onPress={() => { haptic(); setActiveIdx(i); }} />
              ))}
            </View>
            {/* Active feature card */}
            <Animated.View style={aCT}>
              <LinearGradient
                colors={[feat.color + '1a', 'rgba(255,255,255,0.04)', 'rgba(0,0,0,0.25)']}
                style={[s.featCard, { borderColor: feat.color + '48' }]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              >
                {/* Tag */}
                <View style={[s.featTag, { backgroundColor: feat.color + '22', borderColor: feat.color + '44' }]}>
                  <Text style={[s.featTagTxt, { color: feat.color }]}>{'tag' in feat ? (feat as any).tag : ''}</Text>
                </View>

                <View style={s.fcTop}>
                  <LinearGradient colors={[feat.color + '38', feat.color + '1a']} style={s.fcIcon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <Ionicons name={feat.icon} size={24} color={feat.color} />
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fcTitle}>{feat.title}</Text>
                    <View style={[s.fcBadge, { backgroundColor: feat.color + '22', borderColor: feat.color + '55' }]}>
                      <Text style={[s.fcBadgeTxt, { color: feat.color }]}>{feat.badge}</Text>
                    </View>
                  </View>
                  <View style={s.fcStatWrap}>
                    <Text style={[s.fcStat, { color: feat.color }]}>{feat.stat}</Text>
                  </View>
                </View>
                <Text style={s.fcDesc}>{feat.subtitle}</Text>

                {/* Progress dots */}
                <View style={s.dotsRow}>
                  {features.map((_, i) => (
                    <View key={i} style={[s.dot, activeIdx === i && { backgroundColor: feat.color, width: 20, borderRadius: 3 }]} />
                  ))}
                </View>
              </LinearGradient>
            </Animated.View>
          </Animated.View>

          {/* ══════ NOTIFICATION PREVIEW ══════ */}
          <NotifCard title={c.notif.title} body={c.notif.body} time={c.notif.time} delay={960} />

          {/* ══════ LIVE TRUST METRICS ══════ */}
          <Animated.View style={[s.statsRow, aS]}>
            <StatBox value="₦2.5B+" label={c.processed} delay={780} />
            <View style={s.statDiv} />
            <StatBox value="50K+"   label={c.resellers}  delay={880} />
            <View style={s.statDiv} />
            <StatBox value="99.9%"  label={c.uptime}     delay={980} />
          </Animated.View>

          {/* ══════ ACTION BUTTONS ══════ */}
          <Animated.View style={[s.actionWrap, aB]}>
            {checking ? (
              <View style={s.loadCard}>
                <ActivityIndicator size="small" color="#f5a623" />
                <View style={{ flex: 1 }}>
                  <Text style={s.loadTitle}>{c.verify}</Text>
                  <Text style={s.loadSub}>{c.connecting}</Text>
                </View>
              </View>
            ) : (
              <View style={{ gap: 11 }}>
                {/* Primary gold CTA */}
                <TouchableOpacity onPress={() => { haptic(); router.push('/(auth)/login'); }} activeOpacity={0.87} style={s.primaryWrap}>
                  <LinearGradient colors={['#ffe566', '#f5a623', '#d07a10', '#b06010']} locations={[0, 0.33, 0.7, 1]} style={s.primaryBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Ionicons name="person" size={16} color="#010812" />
                    <Text style={s.primaryTxt}>{c.signin}</Text>
                    <View style={s.arrow}><Ionicons name="arrow-forward" size={13} color="#010812" /></View>
                  </LinearGradient>
                </TouchableOpacity>

                {/* Glass secondary */}
                <TouchableOpacity onPress={() => { haptic(); router.push('/(auth)/signup'); }} activeOpacity={0.8} style={s.secondaryBtn}>
                  <Ionicons name="person-add-outline" size={15} color="#dde4ef" style={{ marginRight: 8 }} />
                  <Text style={s.secondaryTxt}>{c.signup}</Text>
                </TouchableOpacity>

                {/* Tertiary tour */}
                <TouchableOpacity onPress={() => router.push('/onboarding')} activeOpacity={0.75} style={s.tourBtn}>
                  <Ionicons name="compass-outline" size={14} color="#f5a623" style={{ marginRight: 5 }} />
                  <Text style={s.tourTxt}>{c.tour}</Text>
                  <Ionicons name="chevron-forward" size={12} color="#f5a62388" style={{ marginLeft: 3 }} />
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>

          {/* ══════ FOOTER ══════ */}
          <Animated.View style={[s.footer, aF]}>
            <LinearGradient colors={['rgba(16,185,129,0.12)', 'rgba(16,185,129,0.04)']} style={s.sslBadge} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Ionicons name="shield-checkmark" size={12} color="#10b981" />
              <Text style={s.sslTxt}>{c.ssl}</Text>
            </LinearGradient>
            <Text style={s.version}>{c.version}</Text>
          </Animated.View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#010812' },
  scroll: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 32 },

  // Aurora orbs
  aurA: { position: 'absolute', top: -120, right: -60,  width: 400, height: 400, borderRadius: 200, backgroundColor: 'rgba(245,166,35,0.13)' },
  aurB: { position: 'absolute', bottom: -130, left: -80, width: 430, height: 430, borderRadius: 215, backgroundColor: 'rgba(14,42,120,0.38)' },
  aurC: { position: 'absolute', top: H*0.38, left: W*0.25, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(168,85,247,0.08)' },
  orbA: { position: 'absolute', top: H*0.08, left: -30, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(56,189,248,0.07)' },
  orbB: { position: 'absolute', top: H*0.58, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(244,63,94,0.07)' },

  // Grid dots
  gridDots: { ...StyleSheet.absoluteFillObject, opacity: 0.025, borderWidth: 1, borderColor: '#fff' },

  // Header
  topBar:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: 'rgba(16,185,129,0.1)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.28)' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  liveTxt: { color: '#10b981', fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
  langBtn: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  langTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },
  waBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 13, backgroundColor: 'rgba(37,211,102,0.11)', borderWidth: 1, borderColor: 'rgba(37,211,102,0.26)' },
  waTxt:   { color: '#25D366', fontSize: 9, fontWeight: '800' },

  // Promo ticker
  tickerWrap: { overflow: 'hidden', marginBottom: 12, borderRadius: 10 },
  tickerBar:  { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(245,166,35,0.22)', overflow: 'hidden' },
  tickerTxt:  { color: '#f5c77a', fontSize: 11, fontWeight: '700', letterSpacing: 0.3, position: 'absolute', whiteSpace: 'nowrap' as any },

  // Logo medallion
  logoArea:  { alignItems: 'center', justifyContent: 'center', marginBottom: 16, position: 'relative' },
  haloGlow:  { position: 'absolute', width: 210, height: 210, borderRadius: 105, backgroundColor: 'rgba(245,166,35,0.15)', shadowColor: '#f5a623', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 48, elevation: 24 },
  medallion: { width: 154, height: 154, borderRadius: 77, padding: 3.5, shadowColor: '#f5a623', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.58, shadowRadius: 28, elevation: 24 },
  medalGrad: { flex: 1, borderRadius: 74, padding: 3, alignItems: 'center', justifyContent: 'center' },
  medalInner:{ width: '100%', height: '100%', borderRadius: 71, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoImg:   { width: 136, height: 136 },
  vBadge:    { position: 'absolute', bottom: 5, right: 8, shadowColor: '#f5a623', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 6, elevation: 8 },
  vBadgeIn:  { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: '#010812' },
  starBadge: { position: 'absolute', top: 6, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: '#f5a623', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#010812', shadowColor: '#f5a623', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 5, elevation: 6 },

  // Brand block
  brandBlock:  { alignItems: 'center', marginBottom: 16 },
  mottoRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, width: '100%' },
  mottoDash:   { flex: 1, height: 1, backgroundColor: 'rgba(245,166,35,0.25)' },
  mottoPill:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, backgroundColor: 'rgba(245,166,35,0.1)', borderWidth: 1, borderColor: 'rgba(245,166,35,0.28)' },
  mottoTxt:    { color: '#f5a623', fontSize: 9.5, fontWeight: '800', letterSpacing: 2 },
  brandRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  brandName:   { color: '#ffffff', fontSize: 30, fontWeight: '900', letterSpacing: 1.5 },
  subChip:     { paddingHorizontal: 9, paddingVertical: 3.5, borderRadius: 8 },
  subTxt:      { color: '#010812', fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  tagline:     { color: '#8ea4c4', fontSize: 12.5, textAlign: 'center', maxWidth: 315, lineHeight: 18.5, marginBottom: 10 },

  // Trust + stars
  trustRow:    { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 14 },
  starsClip:   { overflow: 'hidden', height: 18 },
  stars:       { color: '#f5a623', fontSize: 14, letterSpacing: 2 },
  trustedTxt:  { color: '#94a3b8', fontSize: 11, fontWeight: '600' },

  // Icon strip
  iconStrip:     { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 12 },
  iconStripItem: { alignItems: 'center', gap: 4 },
  iconCircle:    { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  iconLbl:       { fontSize: 8.5, fontWeight: '700', letterSpacing: 0.2 },

  // Network strip
  netRow:    { flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' },
  netChip:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  netTxt:    { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  netMore:   { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  netMoreTxt:{ color: '#64748b', fontSize: 10, fontWeight: '600' },

  // How it works
  stepsWrap:   { width: '100%', maxWidth: 400, alignSelf: 'center', marginBottom: 14 },
  stepsCard:   { borderRadius: 18, borderWidth: 1, borderColor: 'rgba(245,166,35,0.18)', padding: 14 },
  stepsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, justifyContent: 'center' },
  stepsDot:    { width: 4, height: 4, borderRadius: 2, backgroundColor: '#f5a623' },
  stepsTitle:  { color: '#f5a623', fontSize: 9.5, fontWeight: '800', letterSpacing: 2.5 },
  stepsRow:    { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center' },
  stepItem:    { alignItems: 'center', flex: 1, gap: 6 },
  stepCircle:  { width: 22, height: 22, borderRadius: 11, backgroundColor: '#f5a623', alignItems: 'center', justifyContent: 'center' },
  stepNum:     { color: '#010812', fontSize: 11, fontWeight: '900' },
  stepIconCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(245,166,35,0.1)', borderWidth: 1, borderColor: 'rgba(245,166,35,0.28)', alignItems: 'center', justifyContent: 'center' },
  stepLabel:   { color: '#94a3b8', fontSize: 9.5, textAlign: 'center', fontWeight: '600', maxWidth: 70 },
  stepArrow:   { paddingTop: 28 },

  // Feature showcase
  showcaseWrap: { width: '100%', maxWidth: 400, alignSelf: 'center', marginBottom: 12 },
  pillRow:      { flexDirection: 'row', gap: 5, marginBottom: 10 },
  pill:         { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 6, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', flex: 1, justifyContent: 'center' },
  pillIco:      { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  pillTxt:      { color: '#8099b8', fontSize: 9.5, fontWeight: '600' },
  featCard:     { borderRadius: 18, borderWidth: 1.5, padding: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.32, shadowRadius: 18, elevation: 12 },
  featTag:      { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, borderWidth: 1, marginBottom: 10 },
  featTagTxt:   { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.8 },
  fcTop:        { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 9 },
  fcIcon:       { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  fcTitle:      { color: '#ffffff', fontSize: 14.5, fontWeight: '800', marginBottom: 5 },
  fcBadge:      { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2.5, borderRadius: 8, borderWidth: 1 },
  fcBadgeTxt:   { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  fcStatWrap:   { alignItems: 'flex-end', justifyContent: 'center' },
  fcStat:       { fontSize: 13, fontWeight: '900', letterSpacing: 0.2 },
  fcDesc:       { color: '#c2cfe0', fontSize: 12, lineHeight: 17.5, fontWeight: '500', marginBottom: 10 },
  dotsRow:      { flexDirection: 'row', gap: 5, justifyContent: 'center' },
  dot:          { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)' },

  // Notif preview card
  notifCard:   { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 6 },
  notifIcon:   { width: 38, height: 38, borderRadius: 10 },
  notifTitle:  { color: '#f0f4ff', fontSize: 12.5, fontWeight: '800', marginBottom: 2 },
  notifBody:   { color: '#8ea4c4', fontSize: 11, fontWeight: '500' },
  notifTimeWrap: { alignItems: 'flex-end', gap: 5 },
  notifTime:   { color: '#10b981', fontSize: 9, fontWeight: '800' },
  notifDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },

  // Stats row
  statsRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: 400, alignSelf: 'center', paddingVertical: 13, paddingHorizontal: 18, borderRadius: 16, marginBottom: 16, backgroundColor: 'rgba(255,255,255,0.035)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 12, elevation: 6 },
  statNum:   { color: '#f5a623', fontSize: 15, fontWeight: '900' },
  statLbl:   { color: '#64748b', fontSize: 9, fontWeight: '700', marginTop: 2, letterSpacing: 0.3 },
  statDiv:   { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.1)' },

  // Actions
  actionWrap:  { width: '100%', maxWidth: 400, alignSelf: 'center' },
  loadCard:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, paddingHorizontal: 16, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  loadTitle:   { color: '#f0f4ff', fontSize: 13, fontWeight: '700' },
  loadSub:     { color: '#64748b', fontSize: 11, marginTop: 2 },
  primaryWrap: { borderRadius: 16, overflow: 'hidden', shadowColor: '#f5a623', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 22, elevation: 16 },
  primaryBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, paddingHorizontal: 22 },
  primaryTxt:  { color: '#010812', fontSize: 15.5, fontWeight: '900', letterSpacing: 0.3 },
  arrow:       { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(1,8,18,0.18)', alignItems: 'center', justifyContent: 'center' },
  secondaryBtn:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.065)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  secondaryTxt:{ color: '#dde4ef', fontSize: 14, fontWeight: '700', letterSpacing: 0.2 },
  tourBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 9 },
  tourTxt:     { color: '#f5a623', fontSize: 12.5, fontWeight: '700' },

  // Footer
  footer:    { alignItems: 'center', gap: 6, marginTop: 20 },
  sslBadge:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)' },
  sslTxt:    { color: '#475569', fontSize: 10, fontWeight: '600' },
  version:   { color: '#2a3a50', fontSize: 9.5, fontWeight: '500' },
});
