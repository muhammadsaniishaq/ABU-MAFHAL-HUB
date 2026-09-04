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

const { width: W, height: H } = Dimensions.get('window');
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
    processed: '₦2.5B+\nProcessed',
    resellers: '50K+\nResellers',
    uptime: '99.9%\nUptime',
    p2Title: 'Everything You Need',
    p2Sub: 'All your telecom & payment needs in one place',
    p3Title: 'How It Works',
    p3Sub: 'Start earning in 3 simple steps',
    steps: ['Fund Your\nWallet', 'Pick a\nService', 'Get Instant\nDelivery'],
    stepIcons: ['wallet-outline', 'grid-outline', 'checkmark-done-circle-outline'] as const,
    signin: 'Sign In to Account',
    signup: 'Create Free Account',
    skip: 'Skip',
    next: 'Next',
    networks: 'Supported Networks',
    verify: 'Verifying session...',
  },
  ha: {
    lang: '🇬🇧 EN',
    live: 'TSARIN YA AIKI · 99.98%',
    motto: 'AMINCI  ·  INGANCI  ·  DARAJAR',
    brand: 'ABU MAFHAL',
    sub: 'SUB',
    tagline: 'Babban Dandalin Sayen Data\nda Biyan Kudi',
    trusted: '★★★★★  Amintacce ga Masu Amfani 50,000+',
    processed: '₦2.5B+\nAn Sarrafa',
    resellers: '50K+\nMasu Amfani',
    uptime: '99.9%\nNasara',
    p2Title: 'Duk Abin Da Kake Bukata',
    p2Sub: 'Sayen data, airtime da biyan kudi a wuri guda',
    p3Title: 'Yadda Ake Amfani',
    p3Sub: 'Fara samun riba cikin matakai 3',
    steps: ['Cika\nWallet', 'Zabi\nSabis', 'Karba\nNan Take'],
    stepIcons: ['wallet-outline', 'grid-outline', 'checkmark-done-circle-outline'] as const,
    signin: 'Shiga Cikin Asusu',
    signup: 'Bude Sabon Asusu',
    skip: 'Tsallake',
    next: 'Gaba',
    networks: 'Layukan Da Muke Goyan Baya',
    verify: 'Ana duba asusu...',
  },
};

const FEATURES = [
  {
    id: 'data', icon: 'wifi' as const, color: '#38bdf8',
    en: { title: '5G High-Speed Data', sub: 'SME, Corporate & Gifting bundles for MTN, Airtel, Glo & 9mobile — 3-second instant delivery.', badge: 'FROM ₦215/GB', stat: '₦215/GB' },
    ha: { title: 'Ingantacciyar Data', sub: 'Data na SME, Gifting da Corporate na MTN, Airtel, Glo da 9mobile cikin dakika 3.', badge: 'DAGA ₦215/GB', stat: '₦215/GB' },
  },
  {
    id: 'airtime', icon: 'flash' as const, color: '#f5a623',
    en: { title: 'Instant Airtime VTU', sub: 'Automated top-up for all Nigerian networks with real-time cashback up to 3% credited instantly.', badge: 'UP TO 3% CASHBACK', stat: '3% Back' },
    ha: { title: 'Sayen Katin Waya', sub: 'Tura katin waya nan take zuwa kowace layi a Najeriya tare da cashback 3% kai tsaye.', badge: 'RAGIN 3%', stat: '3% Ragi' },
  },
  {
    id: 'bills', icon: 'bulb' as const, color: '#10b981',
    en: { title: 'Electricity & Cable TV', sub: 'Prepaid meter tokens for IKEDC, AEDC, EKEDC & DStv, GOtv, Startimes renewal in seconds.', badge: 'INSTANT TOKEN', stat: '< 5 Secs' },
    ha: { title: 'Biyan Wutar Lantarki', sub: 'Samo lambar wuta (token) da biyan kudin kallo na DStv, GOtv da Startimes cikin sakan 5.', badge: 'TOKEN NAN TAKE', stat: '< 5 Sak.' },
  },
  {
    id: 'wallet', icon: 'card' as const, color: '#a855f7',
    en: { title: 'Virtual Bank Accounts', sub: 'Dedicated bank accounts from Moniepoint, Wema & Sterling with 0-second automatic wallet funding.', badge: 'AUTO-CREDIT', stat: '0-Second' },
    ha: { title: 'Asusun Banki na Musamman', sub: 'Asusun banki daga Moniepoint, Wema da Sterling Bank tare da funding nan take.', badge: 'KUDI NAN TAKE', stat: '0-Sakan' },
  },
  {
    id: 'cashback', icon: 'gift' as const, color: '#f43f5e',
    en: { title: 'Earn & Refer Profits', sub: 'Continuous cashback on every purchase plus lucrative commissions by sharing your referral link.', badge: 'DAILY INCOME', stat: 'Daily ₦₦' },
    ha: { title: 'Samun Riba da Garabasa', sub: 'Sami cashback a kowane sayi tare da alawus idan ka gayyato abokanka.', badge: 'KARIN KUDI', stat: 'Riba Kullum' },
  },
];

const NETWORKS = [
  { name: 'MTN',     color: '#f5c518', bg: 'rgba(245,197,24,0.14)' },
  { name: 'Airtel',  color: '#ff3333', bg: 'rgba(255,51,51,0.14)'  },
  { name: 'Glo',     color: '#22c55e', bg: 'rgba(34,197,94,0.14)'  },
  { name: '9mobile', color: '#a3e635', bg: 'rgba(163,230,53,0.14)' },
];

// ─── FLOATING PARTICLE ────────────────────────────────────────────────────────
function Particle({ x, y, delay, size, color }: { x:number; y:number; delay:number; size:number; color:string }) {
  const op = useSharedValue(0), ty = useSharedValue(0), sc = useSharedValue(0.4);
  useEffect(() => {
    op.value = withDelay(delay, withRepeat(withSequence(withTiming(0.85,{duration:1300}), withTiming(0,{duration:1300})), -1, false));
    ty.value = withDelay(delay, withRepeat(withTiming(-48,{duration:2600,easing:Easing.inOut(Easing.ease)}), -1, true));
    sc.value = withDelay(delay, withRepeat(withSequence(withTiming(1.25,{duration:1300}), withTiming(0.4,{duration:1300})), -1, false));
  }, []);
  const a = useAnimatedStyle(() => ({ opacity: op.value, transform:[{translateY: ty.value},{scale: sc.value}] }));
  return <Animated.View style={[{position:'absolute',left:x,top:y,width:size,height:size,borderRadius:size/2,backgroundColor:color},a]} />;
}

// ─── SPIN RING ────────────────────────────────────────────────────────────────
function SpinRing({ size, delay, color, speed, reverse }: { size:number; delay:number; color:string; speed:number; reverse?:boolean }) {
  const r = useSharedValue(0), op = useSharedValue(0);
  useEffect(() => {
    op.value = withDelay(delay, withTiming(1, {duration:700}));
    r.value = withRepeat(withTiming(reverse ? -360 : 360, {duration:speed, easing:Easing.linear}), -1, false);
  }, []);
  const a = useAnimatedStyle(() => ({ opacity:op.value, transform:[{rotate:`${r.value}deg`}] }));
  return <Animated.View style={[{position:'absolute',width:size,height:size,borderRadius:size/2,borderWidth:1.2,borderColor:color,borderStyle:'dashed'}, a]} />;
}

// ─── SHIMMER BEAM ─────────────────────────────────────────────────────────────
function ShimmerBeam() {
  const tx = useSharedValue(-160);
  useEffect(() => {
    tx.value = withRepeat(withSequence(
      withTiming(160, {duration:1800, easing:Easing.inOut(Easing.ease)}),
      withDelay(2800, withTiming(-160, {duration:0}))
    ), -1, false);
  }, []);
  const a = useAnimatedStyle(() => ({ transform:[{translateX:tx.value},{rotate:'25deg'}] }));
  return <Animated.View style={[{position:'absolute',width:55,height:200,backgroundColor:'rgba(255,255,255,0.16)',borderRadius:32,overflow:'hidden'},a]} />;
}

// ─── DOT INDICATOR ────────────────────────────────────────────────────────────
function Dot({ active, color }: { active:boolean; color:string }) {
  const w = useSharedValue(active ? 22 : 7);
  const op = useSharedValue(active ? 1 : 0.38);
  useEffect(() => {
    w.value = withSpring(active ? 22 : 7, {damping:12, stiffness:100});
    op.value = withTiming(active ? 1 : 0.38, {duration:250});
  }, [active]);
  const a = useAnimatedStyle(() => ({ width:w.value, opacity:op.value }));
  return <Animated.View style={[{height:7,borderRadius:4,backgroundColor:color},a]} />;
}

// ─── PAGE 1: WELCOME ──────────────────────────────────────────────────────────
function PageWelcome({ c, lang, setLang, haptic }: any) {
  const logoSc  = useSharedValue(0), logoOp = useSharedValue(0);
  const titleOp = useSharedValue(0), titleY = useSharedValue(30);
  const statsOp = useSharedValue(0), statsY = useSharedValue(25);
  const halo    = useSharedValue(1);
  const orbY    = useSharedValue(0);

  useEffect(() => {
    logoSc.value  = withDelay(150, withSpring(1, {damping:9, stiffness:75}));
    logoOp.value  = withDelay(150, withTiming(1, {duration:450}));
    titleOp.value = withDelay(380, withTiming(1, {duration:550}));
    titleY.value  = withDelay(380, withTiming(0, {duration:550, easing:Easing.out(Easing.cubic)}));
    statsOp.value = withDelay(580, withTiming(1, {duration:500}));
    statsY.value  = withDelay(580, withTiming(0, {duration:500, easing:Easing.out(Easing.cubic)}));
    halo.value = withRepeat(withSequence(withTiming(1.14,{duration:2300,easing:Easing.inOut(Easing.ease)}), withTiming(1,{duration:2300,easing:Easing.inOut(Easing.ease)})), -1, false);
    orbY.value = withRepeat(withSequence(withTiming(20,{duration:3500,easing:Easing.inOut(Easing.ease)}), withTiming(0,{duration:3500,easing:Easing.inOut(Easing.ease)})), -1, false);
  }, []);

  const aLogo  = useAnimatedStyle(() => ({opacity:logoOp.value, transform:[{scale:logoSc.value}]}));
  const aHalo  = useAnimatedStyle(() => ({transform:[{scale:halo.value}]}));
  const aTitle = useAnimatedStyle(() => ({opacity:titleOp.value, transform:[{translateY:titleY.value}]}));
  const aStats = useAnimatedStyle(() => ({opacity:statsOp.value, transform:[{translateY:statsY.value}]}));
  const aOrbT  = useAnimatedStyle(() => ({transform:[{translateY:orbY.value}]}));
  const aOrbB  = useAnimatedStyle(() => ({transform:[{translateY:-orbY.value}]}));

  const PARTICLES = [
    {x:W*0.05,y:H*0.10,delay:0,   size:4.5,color:'#f5a623'},
    {x:W*0.88,y:H*0.09,delay:350, size:3,  color:'#38bdf8'},
    {x:W*0.93,y:H*0.48,delay:700, size:5,  color:'#a855f7'},
    {x:W*0.02,y:H*0.62,delay:250, size:4,  color:'#10b981'},
    {x:W*0.77,y:H*0.78,delay:550, size:3,  color:'#f5a623'},
    {x:W*0.11,y:H*0.84,delay:900, size:4,  color:'#f43f5e'},
    {x:W*0.52,y:H*0.05,delay:180, size:3,  color:'#38bdf8'},
    {x:W*0.38,y:H*0.92,delay:650, size:5,  color:'#a855f7'},
  ];

  const statItems = [
    {val: c.processed.split('\n')[0], lbl: c.processed.split('\n')[1]},
    {val: c.resellers.split('\n')[0], lbl: c.resellers.split('\n')[1]},
    {val: c.uptime.split('\n')[0],    lbl: c.uptime.split('\n')[1]},
  ];

  return (
    <View style={pg.root}>
      {/* Ambient orbs */}
      <Animated.View style={[pg.orbA, aOrbT]} />
      <Animated.View style={[pg.orbB, aOrbB]} />
      <View style={pg.orbC} />
      {/* Particles */}
      {PARTICLES.map((p,i) => <Particle key={i} {...p} />)}

      {/* Top row */}
      <View style={pg.topRow}>
        <View style={pg.livePill}>
          <View style={pg.liveDot} />
          <Text style={pg.liveTxt}>{c.live}</Text>
        </View>
        <View style={{flexDirection:'row',gap:8,alignItems:'center'}}>
          <TouchableOpacity onPress={() => {haptic(); setLang((l:LangKey) => l==='en'?'ha':'en');}} style={pg.langBtn} activeOpacity={0.8}>
            <Text style={pg.langTxt}>{c.lang}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL('https://wa.me/2348144445438?text=Hello%20Abu%20Mafhal%20Support')} style={pg.waBtn} activeOpacity={0.8}>
            <Ionicons name="logo-whatsapp" size={13} color="#25D366" />
            <Text style={pg.waTxt}>24/7</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Logo area */}
      <Animated.View style={[pg.logoArea, aLogo]}>
        <Animated.View style={[pg.haloGlow, aHalo]} />
        <SpinRing size={196} delay={0}    color="rgba(245,166,35,0.33)"  speed={9500} />
        <SpinRing size={172} delay={350}  color="rgba(255,255,255,0.08)" speed={13500} reverse />
        <SpinRing size={220} delay={700}  color="rgba(56,189,248,0.13)"  speed={17500} />
        <SpinRing size={244} delay={1000} color="rgba(168,85,247,0.09)"  speed={22000} reverse />
        <View style={pg.medallion}>
          <LinearGradient colors={['#ffe566','#f5a623','#b87015','#f5a623','#ffe566']} locations={[0,0.2,0.5,0.8,1]} style={pg.medalGrad} start={{x:0,y:0}} end={{x:1,y:1}}>
            <View style={pg.medalInner}>
              <ShimmerBeam />
              <Image source={require('../assets/images/logo.png')} style={pg.logoImg} resizeMode="contain" />
            </View>
          </LinearGradient>
        </View>
        <View style={pg.vBadge}>
          <LinearGradient colors={['#f5a623','#c77d10']} style={pg.vBadgeIn} start={{x:0,y:0}} end={{x:1,y:1}}>
            <Ionicons name="checkmark" size={9} color="#010812" />
          </LinearGradient>
        </View>
        <View style={pg.starBadge}>
          <Ionicons name="star" size={9} color="#010812" />
        </View>
      </Animated.View>

      {/* Brand text */}
      <Animated.View style={[pg.brandBlock, aTitle]}>
        <View style={pg.mottoRow}>
          <View style={pg.mottoDash} />
          <View style={pg.mottoPill}>
            <Ionicons name="shield-checkmark" size={10} color="#f5a623" style={{marginRight:4}} />
            <Text style={pg.mottoTxt}>{c.motto}</Text>
          </View>
          <View style={pg.mottoDash} />
        </View>
        <View style={pg.brandRow}>
          <Text style={pg.brandName}>{c.brand}</Text>
          <LinearGradient colors={['#f5a623','#c77d10']} style={pg.subChip} start={{x:0,y:0}} end={{x:1,y:1}}>
            <Text style={pg.subTxt}>{c.sub}</Text>
          </LinearGradient>
        </View>
        <Text style={pg.tagline}>{c.tagline}</Text>
        <Text style={pg.trusted}>{c.trusted}</Text>
      </Animated.View>

      {/* Trust stats */}
      <Animated.View style={[pg.statsRow, aStats]}>
        {statItems.map((st, i) => (
          <React.Fragment key={i}>
            {i > 0 && <View style={pg.statDiv} />}
            <View style={pg.statBox}>
              <Text style={pg.statNum}>{st.val}</Text>
              <Text style={pg.statLbl}>{st.lbl}</Text>
            </View>
          </React.Fragment>
        ))}
      </Animated.View>
    </View>
  );
}

// ─── PAGE 2: FEATURES ─────────────────────────────────────────────────────────
function PageFeatures({ lang, c }: { lang:LangKey; c:any }) {
  const titleOp = useSharedValue(0), titleY = useSharedValue(22);
  const listOp  = useSharedValue(0);

  useEffect(() => {
    titleOp.value = withTiming(1, {duration:500});
    titleY.value  = withTiming(0, {duration:500, easing:Easing.out(Easing.cubic)});
    listOp.value  = withDelay(200, withTiming(1, {duration:600}));
  }, []);

  const aTitle = useAnimatedStyle(() => ({opacity:titleOp.value, transform:[{translateY:titleY.value}]}));
  const aList  = useAnimatedStyle(() => ({opacity:listOp.value}));

  return (
    <View style={p2.root}>
      {/* Subtle bg orbs */}
      <View style={p2.orbA} />
      <View style={p2.orbB} />

      <Animated.View style={[p2.header, aTitle]}>
        <LinearGradient colors={['rgba(245,166,35,0.18)','rgba(245,166,35,0.06)']} style={p2.headBadge} start={{x:0,y:0}} end={{x:1,y:0}}>
          <Ionicons name="grid" size={12} color="#f5a623" style={{marginRight:5}} />
          <Text style={p2.headBadgeTxt}>OUR SERVICES</Text>
        </LinearGradient>
        <Text style={p2.headTitle}>{c.p2Title}</Text>
        <Text style={p2.headSub}>{c.p2Sub}</Text>
      </Animated.View>

      <Animated.View style={[{flex:1}, aList]}>
        {FEATURES.map((f, idx) => {
          const info = f[lang];
          const delay = idx * 80;
          return (
            <FeatureRow key={f.id} f={f} info={info} delay={delay} />
          );
        })}
      </Animated.View>
    </View>
  );
}

function FeatureRow({ f, info, delay }: { f:typeof FEATURES[0]; info:any; delay:number }) {
  const op = useSharedValue(0), tx = useSharedValue(-24);
  useEffect(() => {
    op.value = withDelay(delay + 300, withTiming(1, {duration:450}));
    tx.value = withDelay(delay + 300, withTiming(0, {duration:450, easing:Easing.out(Easing.cubic)}));
  }, []);
  const a = useAnimatedStyle(() => ({opacity:op.value, transform:[{translateX:tx.value}]}));
  return (
    <Animated.View style={a}>
      <LinearGradient colors={[f.color+'14','rgba(255,255,255,0.025)']} style={[p2.featureRow, {borderColor:f.color+'35'}]} start={{x:0,y:0}} end={{x:1,y:0}}>
        <LinearGradient colors={[f.color+'30',f.color+'16']} style={p2.fIcon} start={{x:0,y:0}} end={{x:1,y:1}}>
          <Ionicons name={f.icon} size={20} color={f.color} />
        </LinearGradient>
        <View style={{flex:1}}>
          <Text style={p2.fTitle}>{info.title}</Text>
          <Text style={p2.fSub} numberOfLines={2}>{info.sub}</Text>
        </View>
        <View style={{alignItems:'flex-end',gap:4}}>
          <View style={[p2.fBadge,{backgroundColor:f.color+'1a',borderColor:f.color+'44'}]}>
            <Text style={[p2.fBadgeTxt,{color:f.color}]}>{info.badge}</Text>
          </View>
          <Text style={[p2.fStat,{color:f.color}]}>{info.stat}</Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

// ─── PAGE 3: GET STARTED ──────────────────────────────────────────────────────
function PageGetStarted({ c, checking, router, haptic }: any) {
  const titleOp = useSharedValue(0), titleY = useSharedValue(22);
  const stepsOp = useSharedValue(0);
  const btnOp   = useSharedValue(0), btnY = useSharedValue(20);

  useEffect(() => {
    titleOp.value = withTiming(1, {duration:500});
    titleY.value  = withTiming(0, {duration:500, easing:Easing.out(Easing.cubic)});
    stepsOp.value = withDelay(250, withTiming(1, {duration:550}));
    btnOp.value   = withDelay(500, withTiming(1, {duration:500}));
    btnY.value    = withDelay(500, withTiming(0, {duration:500, easing:Easing.out(Easing.cubic)}));
  }, []);

  const aTitle = useAnimatedStyle(() => ({opacity:titleOp.value, transform:[{translateY:titleY.value}]}));
  const aSteps = useAnimatedStyle(() => ({opacity:stepsOp.value}));
  const aBtn   = useAnimatedStyle(() => ({opacity:btnOp.value, transform:[{translateY:btnY.value}]}));

  return (
    <View style={p3.root}>
      <View style={p3.orbA} />
      <View style={p3.orbB} />

      {/* Title */}
      <Animated.View style={[p3.header, aTitle]}>
        <LinearGradient colors={['rgba(245,166,35,0.18)','rgba(245,166,35,0.06)']} style={p3.headBadge} start={{x:0,y:0}} end={{x:1,y:0}}>
          <Ionicons name="rocket" size={12} color="#f5a623" style={{marginRight:5}} />
          <Text style={p3.headBadgeTxt}>GET STARTED</Text>
        </LinearGradient>
        <Text style={p3.headTitle}>{c.p3Title}</Text>
        <Text style={p3.headSub}>{c.p3Sub}</Text>
      </Animated.View>

      {/* How it works steps */}
      <Animated.View style={[p3.stepsContainer, aSteps]}>
        {c.steps.map((label: string, i: number) => (
          <React.Fragment key={i}>
            <View style={p3.stepItem}>
              <LinearGradient colors={['#f5a623','#c77d10']} style={p3.stepNumCircle} start={{x:0,y:0}} end={{x:1,y:1}}>
                <Text style={p3.stepNumTxt}>{i+1}</Text>
              </LinearGradient>
              <View style={p3.stepIconWrap}>
                <Ionicons name={c.stepIcons[i]} size={22} color="#f5a623" />
              </View>
              <Text style={p3.stepLabel}>{label}</Text>
            </View>
            {i < 2 && (
              <View style={p3.stepConnector}>
                <LinearGradient colors={['#f5a62344','transparent']} style={p3.stepConnectorLine} start={{x:0,y:0}} end={{x:1,y:0}} />
                <Ionicons name="chevron-forward" size={14} color="#f5a62366" />
              </View>
            )}
          </React.Fragment>
        ))}
      </Animated.View>

      {/* Networks */}
      <Animated.View style={[p3.netsSection, aSteps]}>
        <Text style={p3.netTitle}>{c.networks}</Text>
        <View style={p3.netRow}>
          {NETWORKS.map(n => (
            <View key={n.name} style={[p3.netChip, {backgroundColor:n.bg, borderColor:n.color+'55'}]}>
              <View style={[p3.netDot, {backgroundColor:n.color}]} />
              <Text style={[p3.netTxt, {color:n.color}]}>{n.name}</Text>
            </View>
          ))}
        </View>
      </Animated.View>

      {/* Notification preview card */}
      <Animated.View style={[p3.notifWrap, aSteps]}>
        <LinearGradient colors={['rgba(16,185,129,0.12)','rgba(16,185,129,0.04)']} style={p3.notifCard} start={{x:0,y:0}} end={{x:1,y:1}}>
          <View style={p3.notifIconBox}>
            <LinearGradient colors={['#f5a623','#c77d10']} style={{flex:1,borderRadius:10,alignItems:'center',justifyContent:'center'}} start={{x:0,y:0}} end={{x:1,y:1}}>
              <Ionicons name="checkmark-circle" size={16} color="#010812" />
            </LinearGradient>
          </View>
          <View style={{flex:1}}>
            <Text style={p3.notifTitle}>Purchase Successful!</Text>
            <Text style={p3.notifBody}>₦1,000 MTN Airtime — delivered instantly</Text>
          </View>
          <View style={p3.notifLive}>
            <View style={p3.notifDot} />
            <Text style={p3.notifNow}>now</Text>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Action buttons */}
      <Animated.View style={[p3.btnArea, aBtn]}>
        {checking ? (
          <View style={p3.loadCard}>
            <ActivityIndicator size="small" color="#f5a623" />
            <Text style={p3.loadTxt}>{c.verify}</Text>
          </View>
        ) : (
          <View style={{gap:10}}>
            <TouchableOpacity onPress={() => { haptic(); router.push('/(auth)/login'); }} activeOpacity={0.87} style={p3.primaryWrap}>
              <LinearGradient colors={['#ffe566','#f5a623','#d07a10','#b06010']} locations={[0,0.33,0.7,1]} style={p3.primaryBtn} start={{x:0,y:0}} end={{x:1,y:0}}>
                <Ionicons name="person" size={16} color="#010812" />
                <Text style={p3.primaryTxt}>{c.signin}</Text>
                <View style={p3.arrow}>
                  <Ionicons name="arrow-forward" size={13} color="#010812" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { haptic(); router.push('/(auth)/signup'); }} activeOpacity={0.8} style={p3.secondaryBtn}>
              <Ionicons name="person-add-outline" size={15} color="#dde4ef" style={{marginRight:8}} />
              <Text style={p3.secondaryTxt}>{c.signup}</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>

      {/* SSL */}
      <View style={p3.ssl}>
        <Ionicons name="shield-checkmark" size={11} color="#10b981" />
        <Text style={p3.sslTxt}>Bank-Grade 256-Bit SSL · NDPA Protected</Text>
      </View>
    </View>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function SplashScreen() {
  const router = useRouter();
  const [checking, setChecking]   = useState(true);
  const [lang, setLang]           = useState<LangKey>('en');
  const [pageIdx, setPageIdx]     = useState(0);
  const flatRef = useRef<FlatList>(null);

  const PAGE_COLORS = ['#f5a623', '#38bdf8', '#10b981'];

  useEffect(() => { checkAuthSession(); }, []);

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

  const goNext = useCallback(() => {
    haptic();
    if (pageIdx < 2) {
      const next = pageIdx + 1;
      flatRef.current?.scrollToIndex({ index: next, animated: true });
      setPageIdx(next);
    }
  }, [pageIdx, haptic]);

  const goSkip = useCallback(() => {
    haptic();
    flatRef.current?.scrollToIndex({ index: 2, animated: true });
    setPageIdx(2);
  }, [haptic]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setPageIdx(viewableItems[0].index);
    }
  });

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 });

  const c = COPY[lang];
  const pages = [
    { key: 'welcome',  comp: <PageWelcome c={c} lang={lang} setLang={setLang} haptic={haptic} /> },
    { key: 'features', comp: <PageFeatures lang={lang} c={c} /> },
    { key: 'start',    comp: <PageGetStarted c={c} checking={checking} router={router} haptic={haptic} /> },
  ];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Deep cosmic background - always visible */}
      <LinearGradient
        colors={['#010812','#050f28','#091a48','#050f28','#010812']}
        locations={[0,0.22,0.5,0.78,1]}
        style={StyleSheet.absoluteFillObject}
        start={{x:0.15,y:0}} end={{x:0.85,y:1}}
      />

      {/* Paged content */}
      <FlatList
        ref={flatRef}
        data={pages}
        renderItem={({ item }) => (
          <View style={{ width: W, height: H }}>
            <SafeAreaView style={{ flex: 1 }}>
              {item.comp}
            </SafeAreaView>
          </View>
        )}
        keyExtractor={item => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={viewabilityConfig.current}
        bounces={false}
        style={{ flex: 1 }}
      />

      {/* Bottom nav bar */}
      <View style={styles.navBar}>
        {/* Dot indicators */}
        <View style={styles.dots}>
          {pages.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => { flatRef.current?.scrollToIndex({index:i,animated:true}); setPageIdx(i); haptic(); }}>
              <Dot active={pageIdx === i} color={PAGE_COLORS[i]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Buttons */}
        {pageIdx < 2 ? (
          <View style={styles.navBtns}>
            <TouchableOpacity onPress={goSkip} style={styles.skipBtn} activeOpacity={0.7}>
              <Text style={styles.skipTxt}>{c.skip}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={goNext} style={styles.nextBtn} activeOpacity={0.87}>
              <LinearGradient colors={['#f5a623','#c77d10']} style={styles.nextGrad} start={{x:0,y:0}} end={{x:1,y:0}}>
                <Text style={styles.nextTxt}>{c.next}</Text>
                <Ionicons name="arrow-forward" size={14} color="#010812" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.navBtns}>
            <TouchableOpacity onPress={() => { flatRef.current?.scrollToIndex({index:0,animated:true}); setPageIdx(0); haptic(); }} style={styles.backBtn} activeOpacity={0.75}>
              <Ionicons name="arrow-back" size={14} color="#94a3b8" style={{marginRight:5}} />
              <Text style={styles.backTxt}>Back</Text>
            </TouchableOpacity>
            <View style={styles.placeholder} />
          </View>
        )}
      </View>
    </View>
  );
}

// ─── STYLES (SHARED) ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:     { flex: 1, backgroundColor: '#010812' },
  navBar:   { paddingHorizontal: 22, paddingBottom: Platform.OS === 'ios' ? 28 : 20, paddingTop: 12, backgroundColor: 'rgba(1,8,18,0.92)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', alignItems: 'center', gap: 14 },
  dots:     { flexDirection: 'row', gap: 7, alignItems: 'center' },
  navBtns:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  skipBtn:  { paddingVertical: 9, paddingHorizontal: 16 },
  skipTxt:  { color: '#64748b', fontSize: 13, fontWeight: '600' },
  nextBtn:  { borderRadius: 14, overflow: 'hidden', shadowColor: '#f5a623', shadowOffset: {width:0,height:6}, shadowOpacity: 0.42, shadowRadius: 14, elevation: 10 },
  nextGrad: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 24 },
  nextTxt:  { color: '#010812', fontSize: 14, fontWeight: '900', letterSpacing: 0.3 },
  backBtn:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 16 },
  backTxt:  { color: '#64748b', fontSize: 13, fontWeight: '600' },
  placeholder: { width: 100 },
});

// ─── PAGE 1 STYLES ────────────────────────────────────────────────────────────
const pg = StyleSheet.create({
  root:       { flex: 1, paddingHorizontal: 20, paddingTop: 6, alignItems: 'center', justifyContent: 'space-evenly' },
  orbA:       { position:'absolute', top:-80, right:-50, width:330, height:330, borderRadius:165, backgroundColor:'rgba(245,166,35,0.16)' },
  orbB:       { position:'absolute', bottom:50, left:-70, width:360, height:360, borderRadius:180, backgroundColor:'rgba(14,42,120,0.38)' },
  orbC:       { position:'absolute', top:H*0.35, left:W*0.18, width:240, height:240, borderRadius:120, backgroundColor:'rgba(245,166,35,0.05)' },
  topRow:     { flexDirection:'row', justifyContent:'space-between', alignItems:'center', width:'100%' },
  livePill:   { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:10, paddingVertical:5, borderRadius:20, backgroundColor:'rgba(16,185,129,0.1)', borderWidth:1, borderColor:'rgba(16,185,129,0.28)' },
  liveDot:    { width:6, height:6, borderRadius:3, backgroundColor:'#10b981' },
  liveTxt:    { color:'#10b981', fontSize:9, fontWeight:'800', letterSpacing:0.7 },
  langBtn:    { paddingHorizontal:9, paddingVertical:4, borderRadius:13, backgroundColor:'rgba(255,255,255,0.09)', borderWidth:1, borderColor:'rgba(255,255,255,0.16)' },
  langTxt:    { color:'#fff', fontSize:10, fontWeight:'800' },
  waBtn:      { flexDirection:'row', alignItems:'center', gap:3, paddingHorizontal:8, paddingVertical:4, borderRadius:13, backgroundColor:'rgba(37,211,102,0.11)', borderWidth:1, borderColor:'rgba(37,211,102,0.26)' },
  waTxt:      { color:'#25D366', fontSize:9, fontWeight:'800' },
  logoArea:   { alignItems:'center', justifyContent:'center', position:'relative' },
  haloGlow:   { position:'absolute', width:208, height:208, borderRadius:104, backgroundColor:'rgba(245,166,35,0.15)', shadowColor:'#f5a623', shadowOffset:{width:0,height:0}, shadowOpacity:0.7, shadowRadius:46, elevation:22 },
  medallion:  { width:152, height:152, borderRadius:76, padding:3.5, shadowColor:'#f5a623', shadowOffset:{width:0,height:12}, shadowOpacity:0.58, shadowRadius:26, elevation:22 },
  medalGrad:  { flex:1, borderRadius:73, padding:3, alignItems:'center', justifyContent:'center' },
  medalInner: { width:'100%', height:'100%', borderRadius:70, backgroundColor:'#ffffff', alignItems:'center', justifyContent:'center', overflow:'hidden' },
  logoImg:    { width:134, height:134 },
  vBadge:     { position:'absolute', bottom:4, right:6, shadowColor:'#f5a623', shadowOffset:{width:0,height:2}, shadowOpacity:0.5, shadowRadius:6, elevation:8 },
  vBadgeIn:   { width:24, height:24, borderRadius:12, alignItems:'center', justifyContent:'center', borderWidth:2.5, borderColor:'#010812' },
  starBadge:  { position:'absolute', top:5, right:5, width:20, height:20, borderRadius:10, backgroundColor:'#f5a623', alignItems:'center', justifyContent:'center', borderWidth:2, borderColor:'#010812' },
  brandBlock: { alignItems:'center', width:'100%' },
  mottoRow:   { flexDirection:'row', alignItems:'center', gap:8, marginBottom:8, width:'100%' },
  mottoDash:  { flex:1, height:1, backgroundColor:'rgba(245,166,35,0.25)' },
  mottoPill:  { flexDirection:'row', alignItems:'center', paddingHorizontal:10, paddingVertical:3, borderRadius:20, backgroundColor:'rgba(245,166,35,0.1)', borderWidth:1, borderColor:'rgba(245,166,35,0.28)' },
  mottoTxt:   { color:'#f5a623', fontSize:9, fontWeight:'800', letterSpacing:1.8 },
  brandRow:   { flexDirection:'row', alignItems:'center', gap:10, marginBottom:5 },
  brandName:  { color:'#ffffff', fontSize:28, fontWeight:'900', letterSpacing:1.5 },
  subChip:    { paddingHorizontal:9, paddingVertical:3.5, borderRadius:8 },
  subTxt:     { color:'#010812', fontSize:13, fontWeight:'900', letterSpacing:0.5 },
  tagline:    { color:'#8ea4c4', fontSize:12, textAlign:'center', lineHeight:18, marginBottom:6 },
  trusted:    { color:'#f5a623', fontSize:11, fontWeight:'700', letterSpacing:0.3 },
  statsRow:   { flexDirection:'row', alignItems:'center', width:'100%', paddingVertical:12, paddingHorizontal:16, borderRadius:16, backgroundColor:'rgba(255,255,255,0.04)', borderWidth:1, borderColor:'rgba(255,255,255,0.08)' },
  statBox:    { alignItems:'center', flex:1 },
  statNum:    { color:'#f5a623', fontSize:16, fontWeight:'900' },
  statLbl:    { color:'#64748b', fontSize:9, fontWeight:'700', marginTop:2, letterSpacing:0.3 },
  statDiv:    { width:1, height:28, backgroundColor:'rgba(255,255,255,0.1)' },
});

// ─── PAGE 2 STYLES ────────────────────────────────────────────────────────────
const p2 = StyleSheet.create({
  root:       { flex:1, paddingHorizontal:18, paddingTop:8 },
  orbA:       { position:'absolute', top:-60, right:-40, width:250, height:250, borderRadius:125, backgroundColor:'rgba(56,189,248,0.09)' },
  orbB:       { position:'absolute', bottom:30, left:-50, width:220, height:220, borderRadius:110, backgroundColor:'rgba(168,85,247,0.07)' },
  header:     { marginBottom:14 },
  headBadge:  { flexDirection:'row', alignItems:'center', alignSelf:'flex-start', paddingHorizontal:12, paddingVertical:5, borderRadius:20, borderWidth:1, borderColor:'rgba(245,166,35,0.28)', marginBottom:8 },
  headBadgeTxt:{ color:'#f5a623', fontSize:9, fontWeight:'800', letterSpacing:1.5 },
  headTitle:  { color:'#ffffff', fontSize:22, fontWeight:'900', letterSpacing:0.5, marginBottom:4 },
  headSub:    { color:'#8ea4c4', fontSize:12, fontWeight:'500' },
  featureRow: { flexDirection:'row', alignItems:'center', gap:12, padding:12, borderRadius:16, borderWidth:1.2, marginBottom:10 },
  fIcon:      { width:44, height:44, borderRadius:13, alignItems:'center', justifyContent:'center' },
  fTitle:     { color:'#ffffff', fontSize:13.5, fontWeight:'800', marginBottom:3 },
  fSub:       { color:'#8ea4c4', fontSize:10.5, lineHeight:15 },
  fBadge:     { paddingHorizontal:7, paddingVertical:2, borderRadius:7, borderWidth:1 },
  fBadgeTxt:  { fontSize:8.5, fontWeight:'800', letterSpacing:0.4 },
  fStat:      { fontSize:11, fontWeight:'900' },
});

// ─── PAGE 3 STYLES ────────────────────────────────────────────────────────────
const p3 = StyleSheet.create({
  root:          { flex:1, paddingHorizontal:20, paddingTop:8, justifyContent:'space-between' },
  orbA:          { position:'absolute', top:-60, left:-50, width:260, height:260, borderRadius:130, backgroundColor:'rgba(245,166,35,0.09)' },
  orbB:          { position:'absolute', bottom:80, right:-50, width:220, height:220, borderRadius:110, backgroundColor:'rgba(16,185,129,0.07)' },
  header:        { marginBottom:10 },
  headBadge:     { flexDirection:'row', alignItems:'center', alignSelf:'flex-start', paddingHorizontal:12, paddingVertical:5, borderRadius:20, borderWidth:1, borderColor:'rgba(245,166,35,0.28)', marginBottom:8 },
  headBadgeTxt:  { color:'#f5a623', fontSize:9, fontWeight:'800', letterSpacing:1.5 },
  headTitle:     { color:'#ffffff', fontSize:22, fontWeight:'900', letterSpacing:0.5, marginBottom:4 },
  headSub:       { color:'#8ea4c4', fontSize:12, fontWeight:'500' },
  stepsContainer:{ flexDirection:'row', alignItems:'flex-start', justifyContent:'center', marginBottom:12 },
  stepItem:      { alignItems:'center', gap:6, flex:1 },
  stepNumCircle: { width:26, height:26, borderRadius:13, alignItems:'center', justifyContent:'center' },
  stepNumTxt:    { color:'#010812', fontSize:12, fontWeight:'900' },
  stepIconWrap:  { width:50, height:50, borderRadius:25, backgroundColor:'rgba(245,166,35,0.1)', borderWidth:1.5, borderColor:'rgba(245,166,35,0.3)', alignItems:'center', justifyContent:'center' },
  stepLabel:     { color:'#94a3b8', fontSize:10, textAlign:'center', fontWeight:'700', maxWidth:76, lineHeight:14 },
  stepConnector: { flexDirection:'row', alignItems:'center', paddingTop:52, gap:2 },
  stepConnectorLine:{ width:16, height:1.5, borderRadius:1 },
  netsSection:   { marginBottom:10 },
  netTitle:      { color:'#64748b', fontSize:9.5, fontWeight:'700', letterSpacing:1.2, marginBottom:8, textAlign:'center' },
  netRow:        { flexDirection:'row', gap:8, justifyContent:'center', flexWrap:'wrap' },
  netChip:       { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:12, paddingVertical:6, borderRadius:12, borderWidth:1 },
  netDot:        { width:6, height:6, borderRadius:3 },
  netTxt:        { fontSize:11, fontWeight:'900', letterSpacing:0.3 },
  notifWrap:     { marginBottom:12 },
  notifCard:     { flexDirection:'row', alignItems:'center', gap:11, padding:12, borderRadius:16, borderWidth:1, borderColor:'rgba(16,185,129,0.2)' },
  notifIconBox:  { width:38, height:38, borderRadius:10 },
  notifTitle:    { color:'#f0f4ff', fontSize:12.5, fontWeight:'800', marginBottom:2 },
  notifBody:     { color:'#8ea4c4', fontSize:10.5 },
  notifLive:     { alignItems:'center', gap:4 },
  notifDot:      { width:6, height:6, borderRadius:3, backgroundColor:'#10b981' },
  notifNow:      { color:'#10b981', fontSize:9, fontWeight:'800' },
  btnArea:       { marginBottom:6 },
  loadCard:      { flexDirection:'row', alignItems:'center', gap:10, paddingVertical:14, paddingHorizontal:16, borderRadius:14, backgroundColor:'rgba(255,255,255,0.03)', borderWidth:1, borderColor:'rgba(255,255,255,0.07)' },
  loadTxt:       { color:'#94a3b8', fontSize:13, fontWeight:'600' },
  primaryWrap:   { borderRadius:16, overflow:'hidden', shadowColor:'#f5a623', shadowOffset:{width:0,height:8}, shadowOpacity:0.46, shadowRadius:18, elevation:14 },
  primaryBtn:    { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:10, paddingVertical:15, paddingHorizontal:20 },
  primaryTxt:    { color:'#010812', fontSize:15, fontWeight:'900', letterSpacing:0.3 },
  arrow:         { width:24, height:24, borderRadius:12, backgroundColor:'rgba(1,8,18,0.18)', alignItems:'center', justifyContent:'center' },
  secondaryBtn:  { flexDirection:'row', alignItems:'center', justifyContent:'center', paddingVertical:14, borderRadius:16, backgroundColor:'rgba(255,255,255,0.065)', borderWidth:1, borderColor:'rgba(255,255,255,0.18)', marginTop:10 },
  secondaryTxt:  { color:'#dde4ef', fontSize:13.5, fontWeight:'700' },
  ssl:           { flexDirection:'row', alignItems:'center', gap:5, justifyContent:'center', paddingBottom:4 },
  sslTxt:        { color:'#334155', fontSize:9.5, fontWeight:'600' },
});
