import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  StatusBar as RNStatusBar,
  Linking,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../services/supabase';

const { width: W, height: H } = Dimensions.get('window');

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  navy:    '#0d1b3e',
  navyMid: '#142258',
  gold:    '#f5a623',
  goldDk:  '#d4890e',
  white:   '#ffffff',
  bg:      '#f4f6fb',
  card:    '#ffffff',
  gray1:   '#e8ecf7',
  gray2:   '#a8b3d4',
  gray3:   '#5a6890',
  text:    '#0d1b3e',
  textSub: '#4a567a',
  r6:  6,  r8: 8,  r12: 12, r16: 16, r20: 20, r24: 24, r99: 99,
};

// ─── Quick action items ───────────────────────────────────────────────────────
const ACTIONS = [
  { label: 'Airtime',     icon: 'phone-portrait-outline' as const, bg: '#fff4e0', color: '#f97316' },
  { label: 'Data',        icon: 'wifi-outline'            as const, bg: '#e8f0ff', color: '#2563eb' },
  { label: 'Bills',       icon: 'receipt-outline'         as const, bg: '#e0fff4', color: '#10b981' },
  { label: 'Electricity', icon: 'flash-outline'           as const, bg: '#fffbe0', color: '#eab308' },
  { label: 'Cable TV',    icon: 'tv-outline'              as const, bg: '#f0e8ff', color: '#8b5cf6' },
  { label: 'Education',   icon: 'school-outline'          as const, bg: '#ffe8f8', color: '#ec4899' },
  { label: 'NIN Svc.',    icon: 'card-outline'            as const, bg: '#e0f8ff', color: '#0d9488' },
  { label: 'More',        icon: 'grid-outline'            as const, bg: '#f0f2f8', color: '#64748b' },
];

// ─── Service cards ────────────────────────────────────────────────────────────
const SERVICES = [
  { title: 'Airtime & Data',  desc: 'Top up any network and buy affordable data plans.',        icon: 'phone-portrait-outline' as const, color: '#f97316', route: '/airtime'       },
  { title: 'Bill Payments',   desc: 'Pay for electricity, cable TV, internet and other bills.', icon: 'document-text-outline'  as const, color: '#2563eb', route: '/bills'         },
  { title: 'Electricity',     desc: 'Buy electricity tokens quickly and conveniently.',          icon: 'flash-outline'          as const, color: '#eab308', route: '/bills'         },
  { title: 'Cable TV',        desc: 'Subscribe and renew your favourite TV subscriptions.',     icon: 'tv-outline'             as const, color: '#8b5cf6', route: '/bills'         },
  { title: 'Internet',        desc: 'Pay for internet subscriptions easily.',                   icon: 'wifi-outline'           as const, color: '#ec4899', route: '/bills'         },
  { title: 'Education',       desc: 'Pay school fees and other educational bills.',             icon: 'school-outline'         as const, color: '#10b981', route: '/education'     },
  { title: 'NIN Services',    desc: 'Access NIN related services quickly and securely.',        icon: 'card-outline'           as const, color: '#0d9488', route: '/nin-services'  },
  { title: 'More Services',   desc: 'Explore more amazing services in one sub.',               icon: 'grid-outline'           as const, color: '#64748b', route: '/(app)/dashboard' },
];

// ─── Operators ────────────────────────────────────────────────────────────────
const OPS = [
  { img: require('../assets/images/mtn.png'),     name: 'MTN'     },
  { img: require('../assets/images/airtel.png'),  name: 'Airtel'  },
  { img: require('../assets/images/glo.png'),     name: 'Glo'     },
  { img: require('../assets/images/9mobile.png'), name: '9mobile' },
];

// ─── Hook: fade-in + slide-up ─────────────────────────────────────────────────
function useReveal(delay = 0) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;
  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(opacity,     { toValue: 1, duration: 500, delay, useNativeDriver: true }),
      Animated.timing(translateY,  { toValue: 0, duration: 500, delay, useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, []);
  return { opacity, transform: [{ translateY }] } as any;
}

// ─── Phone Mockup ─────────────────────────────────────────────────────────────
function PhoneMockup({ width: customWidth }: { width?: number }) {
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: -8, duration: 1800, useNativeDriver: true }),
      Animated.timing(float, { toValue:  0, duration: 1800, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  const PW = customWidth || W * 0.52;
  const PH = PW * 2.08;

  return (
    <View style={{ width: PW, height: PH, marginVertical: 12, alignItems: 'center', justifyContent: 'center' }}>
      {/* decorative gold orb */}
      <View style={[ph.orb, { backgroundColor: T.gold, width: PW * 0.26, height: PW * 0.26, borderRadius: (PW * 0.26) / 2, top: -PW * 0.05, left: -PW * 0.12, opacity: 0.9 }]} />

      <Animated.View style={{ transform: [{ translateY: float }], width: '100%', height: '100%' }}>
        {/* phone shell */}
        <View style={[ph.frame, { width: PW, height: PH, borderRadius: PW * 0.14 }]}>
          {/* status bar */}
          <View style={ph.status}>
            <Text style={ph.statusTxt}>09:41</Text>
            <View style={{ flexDirection: 'row', gap: 3 }}>
              <Ionicons name="cellular"     size={9}  color="#fff" />
              <Ionicons name="wifi"         size={9}  color="#fff" />
              <Ionicons name="battery-full" size={11} color="#fff" />
            </View>
          </View>

          {/* screen */}
          <View style={[ph.screen, { flex: 1, borderRadius: PW * 0.12 }]}>
            {/* header */}
            <View style={ph.hdr}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Image source={require('../assets/images/logo.png')} style={{ width: 17, height: 17 }} resizeMode="contain" />
                <Text style={ph.hdrTxt}>MAFHAL SUB</Text>
              </View>
              <View style={ph.bell}>
                <Ionicons name="notifications-outline" size={12} color={T.navy} />
              </View>
            </View>

            {/* wallet */}
            <LinearGradient colors={[T.navy, '#1e3a7a']} style={ph.wallet} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={ph.walLbl}>Wallet Balance</Text>
              <Text style={ph.walAmt}><Text style={{ color: T.gold }}>₦</Text>25,680.30</Text>
              <View style={ph.fundBtn}>
                <Ionicons name="add" size={8} color={T.navy} />
                <Text style={ph.fundTxt}>Fund Wallet</Text>
              </View>
            </LinearGradient>

            {/* quick actions */}
            <Text style={ph.qaLbl}>QUICK ACTIONS</Text>
            <View style={ph.qaGrid}>
              {ACTIONS.map((a, i) => (
                <View key={i} style={[ph.qaItem, { backgroundColor: a.bg }]}>
                  <Ionicons name={a.icon} size={13} color={a.color} />
                  <Text style={ph.qaText} numberOfLines={1}>{a.label}</Text>
                </View>
              ))}
            </View>

            {/* bottom nav */}
            <View style={ph.nav}>
              {[
                { n: 'Home',    ic: 'home'          as const, a: true  },
                { n: 'Wallet',  ic: 'wallet-outline' as const, a: false },
                { n: 'History', ic: 'time-outline'   as const, a: false },
                { n: 'Profile', ic: 'person-outline' as const, a: false },
              ].map((t, i) => (
                <View key={i} style={{ alignItems: 'center', gap: 2 }}>
                  <Ionicons name={t.ic} size={13} color={t.a ? T.gold : T.gray2} />
                  <Text style={[ph.navTxt, { color: t.a ? T.gold : T.gray2 }]}>{t.n}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </Animated.View>

      {/* navy orb with logo */}
      <View style={[ph.orb, { backgroundColor: T.navy, width: PW * 0.35, height: PW * 0.35, borderRadius: (PW * 0.35) / 2, bottom: -PW * 0.06, right: -PW * 0.14, alignItems: 'center', justifyContent: 'center', zIndex: 10 }]}>
        <Image source={require('../assets/images/logo.png')} style={{ width: PW * 0.21, height: PW * 0.21 }} resizeMode="contain" />
      </View>
    </View>
  );
}

function ShieldGraphic() {
  return (
    <View style={sg.container}>
      {/* background glow */}
      <View style={sg.glow} />
      
      {/* shield shape */}
      <LinearGradient colors={['#102a5a', '#081430']} style={sg.shield}>
        <Ionicons name="shield-checkmark" size={32} color={T.gold} />
      </LinearGradient>

      {/* foreground gold padlock */}
      <View style={sg.lockContainer}>
        <LinearGradient colors={[T.gold, T.goldDk]} style={sg.padlock}>
          <Ionicons name="lock-closed" size={15} color={T.navy} />
        </LinearGradient>
      </View>
    </View>
  );
}

const sg = StyleSheet.create({
  container: {
    width: 90,
    height: 90,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(245, 166, 35, 0.12)',
  },
  shield: {
    width: 66,
    height: 74,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: T.gold,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-10deg' }],
  },
  lockContainer: {
    position: 'absolute',
    bottom: 0,
    right: 2,
  },
  padlock: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: T.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Landing() {
  const router = useRouter();
  const { ref } = useLocalSearchParams<{ ref?: string }>();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [servicesY, setServicesY] = useState(0);
  const [aboutY, setAboutY] = useState(0);

  // auto-login & deep link redirect
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace('/(app)/dashboard');
      } else if (ref) {
        // If there's a referral code, immediately send them to the register screen!
        router.replace(`/auth/login?ref=${ref}`);
      }
    });
  }, [ref]);

  const handleQuickLink = (linkName: string) => {
    switch (linkName) {
      case 'Home':
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        break;
      case 'Services':
        scrollRef.current?.scrollTo({ y: servicesY - 60, animated: true });
        break;
      case 'About Us':
        scrollRef.current?.scrollTo({ y: aboutY - 60, animated: true });
        break;
      case 'Contact':
        scrollRef.current?.scrollToEnd({ animated: true });
        break;
    }
  };

  const handleSupportLink = (linkName: string) => {
    switch (linkName) {
      case 'Help Center':
      case 'FAQs':
        router.push('/support');
        break;
      case 'Privacy Policy':
        router.push('/privacy');
        break;
      case 'Terms & Conditions':
        router.push('/terms');
        break;
    }
  };

  const handleContactLink = (type: 'phone' | 'email' | 'location') => {
    if (type === 'phone') {
      Linking.openURL('tel:+2348145853539');
    } else if (type === 'email') {
      Linking.openURL('mailto:admin@abumafhal.com.ng');
    } else if (type === 'location') {
      Linking.openURL('https://maps.google.com/?q=123+Goni+Aji+Street,+Gashua,+Yobe+State');
    }
  };

  const handleProtectedAction = async (targetRoute: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      router.push(targetRoute as any);
    } else {
      router.push({
        pathname: '/(auth)/login',
        params: { redirectTo: targetRoute }
      });
    }
  };

  const r0 = useReveal(0);
  const r1 = useReveal(120);
  const r2 = useReveal(240);

  const CARD_W = (W - 32 - 10) / 2;

  return (
    <View style={{ flex: 1, backgroundColor: T.white }}>
      <StatusBar style="dark" />

      {/* ══ NAVBAR ═══════════════════════════════════════════════════════════ */}
      <View style={[s.navbar, { paddingTop: insets.top + 6 }]}>
        {/* logo */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Image source={require('../assets/images/logo.png')} style={{ width: 36, height: 36 }} resizeMode="contain" />
          <View>
            <Text style={s.navBrand}>MAFHAL</Text>
            <Text style={s.navSub}>SUB</Text>
          </View>
        </View>
        {/* right */}
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')} style={s.navOutline} activeOpacity={0.8}>
            <Text style={s.navOutlineTxt}>Login</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/onboarding')} style={s.navFill} activeOpacity={0.85}>
            <Text style={s.navFillTxt}>Get Started</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: insets.top + 60 }}
        showsVerticalScrollIndicator={false}
        bounces
      >

        {/* ══ HERO ═════════════════════════════════════════════════════════════ */}
        <LinearGradient colors={['#eef2ff', '#f0f4ff', '#f8f5ff']} style={s.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={s.heroRow}>
            {/* Left Column */}
            <View style={s.heroLeft}>
              {/* badge */}
              <Animated.View style={[s.badge, r0]}>
                <Ionicons name="star" size={10} color={T.goldDk} />
                <Text style={s.badgeTxt}>WELCOME TO MAFHAL SUB</Text>
              </Animated.View>

              {/* headline */}
              <Animated.Text style={[s.headline, r1]}>
                One Sub.{'\n'}
                <Text style={{ color: T.gold }}>Every Payment.{'\n'}</Text>
                Total Convenience.
              </Animated.Text>

              {/* subline */}
              <Animated.Text style={[s.subline, r2]}>
                Buy data, airtime, pay bills, access NIN services and more — all in one secure, fast and reliable platform.
              </Animated.Text>

              {/* CTA buttons */}
              <Animated.View style={[s.ctaRow, r2]}>
                <TouchableOpacity onPress={() => router.push('/onboarding')} style={s.btnDark} activeOpacity={0.85}>
                  <Text style={s.btnDarkTxt}>Get Started</Text>
                  <View style={s.btnArrow}>
                    <Ionicons name="arrow-forward" size={11} color={T.navy} />
                  </View>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => scrollRef.current?.scrollTo({ y: servicesY - 60, animated: true })} style={s.btnLight} activeOpacity={0.85}>
                  <Text style={s.btnLightTxt}>Explore Services</Text>
                  <Ionicons name="arrow-forward" size={11} color={T.navy} />
                </TouchableOpacity>
              </Animated.View>

              {/* social proof */}
              <View style={s.trustRow}>
                <View style={{ flexDirection: 'row' }}>
                  {[['A','#1a3a6e'],['B','#2d5a9e'],['C','#4a7abf']].map(([l, bg], i) => (
                    <View key={i} style={[s.avatar, { backgroundColor: bg, marginLeft: i === 0 ? 0 : -9 }]}>
                      <Text style={s.avatarTxt}>{l}</Text>
                    </View>
                  ))}
                </View>
                <Text style={s.trustTxt} numberOfLines={2}>
                  Trusted by <Text style={{ fontWeight: '800', color: T.navy }}>50,000+</Text> users across Nigeria 🇳🇬
                </Text>
              </View>
            </View>

            {/* Right Column */}
            <View style={s.heroRight}>
              <Animated.View style={[r2, { alignItems: 'center', justifyContent: 'center', width: '100%' }]}>
                <PhoneMockup width={W > 768 ? 250 : W * 0.38} />
              </Animated.View>
            </View>
          </View>
        </LinearGradient>

        {/* ══ NETWORKS BANNER ══════════════════════════════════════════════════ */}
        <View style={s.netBanner}>
          <Text style={s.netLabel}>Top Up Airtime & Buy Data</Text>
          <View style={s.netRow}>
            <View style={s.netLogos}>
              {OPS.map((op, i) => (
                <View key={i} style={s.netChip}>
                  <Image source={op.img} style={s.netImg} resizeMode="contain" />
                </View>
              ))}
            </View>
            <TouchableOpacity onPress={() => handleProtectedAction('/airtime')} style={s.netCta} activeOpacity={0.85}>
              <Text style={s.netCtaTxt}>Buy Now</Text>
              <Ionicons name="arrow-forward" size={10} color={T.white} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ══ SERVICES ═════════════════════════════════════════════════════════ */}
        <View onLayout={(e) => setServicesY(e.nativeEvent.layout.y)} style={s.svcSection}>
          {/* heading */}
          <Text style={s.sectionTag}>WHAT WE OFFER</Text>
          <Text style={s.sectionTitle}>All Your Essentials In One Place</Text>
          <View style={s.sectionBar} />

          {/* 2-column grid */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {SERVICES.map((svc, i) => (
              <TouchableOpacity
                key={i}
                style={[s.svcCard, { width: CARD_W }]}
                onPress={() => handleProtectedAction(svc.route)}
                activeOpacity={0.8}
              >
                <View style={[s.svcIcon, { backgroundColor: svc.color + '18' }]}>
                  <Ionicons name={svc.icon} size={22} color={svc.color} />
                </View>
                <Text style={s.svcName}>{svc.title}</Text>
                <Text style={s.svcDesc} numberOfLines={2}>{svc.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ══ TRUST ════════════════════════════════════════════════════════════ */}
        <LinearGradient onLayout={(e) => setAboutY(e.nativeEvent.layout.y)} colors={[T.navy, T.navyMid]} style={s.trustSection} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={s.trustSectionRow}>
            {/* Left Column (Graphic) */}
            <View style={s.trustLeft}>
              <ShieldGraphic />
            </View>

            {/* Right Column (Content) */}
            <View style={s.trustRight}>
              <Text style={s.trustTitle}>
                Secure. <Text style={{ color: T.gold }}>Fast.</Text> Reliable.
              </Text>
              <Text style={s.trustDesc}>
                Your transactions are protected with top-tier security.
              </Text>
              <View style={s.trustBadges}>
                {[
                  { icon: 'shield-checkmark-outline', label: '100% Secure' },
                  { icon: 'flash-outline',            label: 'Instant Delivery' },
                  { icon: 'headset-outline',          label: '24/7 Support' },
                ].map((b, i) => (
                  <View key={i} style={s.trustBadge}>
                    <Ionicons name={b.icon as any} size={13} color={T.gold} />
                    <Text style={s.trustBadgeTxt}>{b.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* ══ DOWNLOAD ═════════════════════════════════════════════════════════ */}
        <View style={s.dlSection}>
          <View style={s.dlRow}>
            {/* Left Column */}
            <View style={s.dlLeft}>
              <Text style={s.dlTitle}>
                Experience the power of{' '}
                <Text style={{ color: T.gold }}>convenience.</Text>
              </Text>
              <Text style={s.dlDesc}>Download the Mafhal Sub app today.</Text>

              {/* store buttons */}
              <View style={s.storeRow}>
                <TouchableOpacity style={s.storeBtn} onPress={() => Linking.openURL('https://play.google.com/store')} activeOpacity={0.85}>
                  <Ionicons name="logo-google-playstore" size={16} color={T.white} />
                  <View>
                    <Text style={s.storeSml}>Get it on</Text>
                    <Text style={s.storeBig}>Google Play</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={s.storeBtn} onPress={() => Linking.openURL('https://apps.apple.com')} activeOpacity={0.85}>
                  <Ionicons name="logo-apple" size={16} color={T.white} />
                  <View>
                    <Text style={s.storeSml}>Download on the</Text>
                    <Text style={s.storeBig}>App Store</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Right Column */}
            <View style={s.dlRight}>
              <View style={s.qrBox}>
                <Image source={require('../assets/images/qr-code.png')} style={{ width: 62, height: 62 }} resizeMode="contain" />
              </View>
              <Text style={s.qrLbl}>Scan to Download</Text>
            </View>
          </View>
        </View>

        {/* ══ FOOTER ═══════════════════════════════════════════════════════════ */}
        <View style={[s.footer, { paddingBottom: insets.bottom + 24 }]}>
          {/* brand */}
          <View style={s.ftBrand}>
            <Image source={require('../assets/images/logo.png')} style={{ width: 38, height: 38 }} resizeMode="contain" />
            <View>
              <Text style={s.ftBrandTxt}>MAFHAL</Text>
              <Text style={s.ftSubTxt}>SUB</Text>
            </View>
          </View>
          <Text style={s.ftTagline}>One Sub, Endless Possibilities.</Text>

          {/* links grid */}
          <View style={s.ftGrid}>
            <View style={{ flex: 1 }}>
              <Text style={s.ftColHd}>Quick Links</Text>
              {['Home','Services','About Us','Contact'].map((l, i) => (
                <TouchableOpacity key={i} onPress={() => handleQuickLink(l)} activeOpacity={0.7}>
                  <Text style={s.ftLink}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.ftColHd}>Support</Text>
              {['Help Center','FAQs','Privacy Policy','Terms & Conditions'].map((l, i) => (
                <TouchableOpacity key={i} onPress={() => handleSupportLink(l)} activeOpacity={0.7}>
                  <Text style={s.ftLink}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* contact */}
          <View style={{ marginTop: 18 }}>
            <Text style={s.ftColHd}>Contact Us</Text>
            {[
              { type: 'phone' as const, ic: 'call-outline' as const, v: '08145853539' },
              { type: 'email' as const, ic: 'mail-outline' as const, v: 'admin@abumafhal.com.ng' },
              { type: 'location' as const, ic: 'location-outline' as const, v: '123 Goni Aji Street, Gashua, Yobe State' },
            ].map((c, i) => (
              <TouchableOpacity key={i} onPress={() => handleContactLink(c.type)} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Ionicons name={c.ic} size={13} color={T.gold} />
                <Text style={s.ftLink}>{c.v}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={s.ftDivider} />
          <Text style={s.ftCopy}>© {new Date().getFullYear()} Mafhal Sub. All rights reserved.</Text>
          <Text style={[s.ftCopy, { marginTop: 4 }]}>CAC Reg No: 8979939</Text>
        </View>

      </ScrollView>
    </View>
  );
}

// ─── Phone mockup sub-styles (inner) ─────────────────────────────────────────
const ph = StyleSheet.create({
  orb:      { position: 'absolute' },
  frame:    { backgroundColor: T.navy, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.32, shadowRadius: 22, elevation: 18 },
  status:   { backgroundColor: T.navy, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 5 },
  statusTxt:{ color: T.white, fontSize: 9, fontWeight: '700' },
  screen:   { backgroundColor: '#f0f2fb', overflow: 'hidden' },
  hdr:      { backgroundColor: T.white, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e0e4f0' },
  hdrTxt:   { fontSize: 8, fontWeight: '900', color: T.navy },
  bell:     { width: 20, height: 20, borderRadius: 10, backgroundColor: T.gold, alignItems: 'center', justifyContent: 'center' },
  wallet:   { margin: 8, borderRadius: 11, padding: 10 },
  walLbl:   { fontSize: 7, color: 'rgba(255,255,255,0.6)', marginBottom: 3 },
  walAmt:   { fontSize: 14, fontWeight: '800', color: T.white, marginBottom: 8 },
  fundBtn:  { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start', backgroundColor: T.gold, borderRadius: 14, paddingHorizontal: 8, paddingVertical: 4 },
  fundTxt:  { fontSize: 7, fontWeight: '800', color: T.navy },
  qaLbl:    { fontSize: 7, fontWeight: '700', color: '#8090b0', paddingHorizontal: 10, paddingTop: 4, paddingBottom: 4, letterSpacing: 0.5 },
  qaGrid:   { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 6, gap: 4, paddingBottom: 6 },
  qaItem:   { width: '22%', alignItems: 'center', gap: 3, paddingVertical: 6, borderRadius: 8 },
  qaText:   { fontSize: 6, fontWeight: '600', color: '#5a6890', textAlign: 'center' },
  nav:      { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: T.white, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e0e4f0', paddingVertical: 6 },
  navTxt:   { fontSize: 6, fontWeight: '700' },
});

// ─── Main StyleSheet ──────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // Navbar
  navbar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(13,27,62,0.1)',
    shadowColor: T.navy, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 4,
  },
  navBrand:    { fontSize: 15, fontWeight: '900', color: T.navy, letterSpacing: 0.3, lineHeight: 18 },
  navSub:      { fontSize: 10,  fontWeight: '700', color: T.gold, letterSpacing: 1.2, lineHeight: 12 },
  navOutline:  { paddingHorizontal: 14, paddingVertical: 7, borderRadius: T.r8, borderWidth: 1.5, borderColor: T.navy },
  navOutlineTxt:{ fontSize: 12, fontWeight: '700', color: T.navy },
  navFill:     { paddingHorizontal: 15, paddingVertical: 8, borderRadius: T.r8, backgroundColor: T.gold },
  navFillTxt:  { fontSize: 12, fontWeight: '800', color: T.navy },

  // Hero
  hero:        { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },
  heroRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  heroLeft:    { width: '56%', maxWidth: '56%', flexShrink: 1, paddingRight: 6 },
  heroRight:   { width: '42%', maxWidth: '42%', flexShrink: 1, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  badge:       { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: 'rgba(245,166,35,0.1)', borderWidth: 1, borderColor: 'rgba(245,166,35,0.28)', borderRadius: T.r99, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 8 },
  badgeTxt:    { fontSize: W > 768 ? 10 : 8.5, fontWeight: '700', color: T.goldDk, letterSpacing: 0.4 },
  headline:    { fontSize: W > 768 ? 42 : 22, fontWeight: '900', color: T.navy, lineHeight: W > 768 ? 50 : 27, letterSpacing: -0.4, marginBottom: 6 },
  subline:     { fontSize: W > 768 ? 14 : 12, color: T.textSub, lineHeight: W > 768 ? 20 : 16, marginBottom: 10 },
  ctaRow:      { flexDirection: W > 768 ? 'row' : 'column', gap: 8, marginBottom: 12, width: '100%' },
  btnDark:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: T.navy, borderRadius: T.r8, paddingHorizontal: W > 768 ? 16 : 10, paddingVertical: W > 768 ? 11 : 9, shadowColor: T.navy, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 8, elevation: 5, width: W > 768 ? '48%' : '100%' },
  btnDarkTxt:  { fontSize: W > 768 ? 13 : 12, fontWeight: '800', color: T.white },
  btnArrow:    { width: 18, height: 18, borderRadius: 9, backgroundColor: T.gold, alignItems: 'center', justifyContent: 'center' },
  btnLight:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: T.r8, paddingHorizontal: W > 768 ? 14 : 10, paddingVertical: W > 768 ? 11 : 9, borderWidth: 1.5, borderColor: T.navy, width: W > 768 ? '48%' : '100%' },
  btnLightTxt: { fontSize: W > 768 ? 13 : 12, fontWeight: '700', color: T.navy },
  trustRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  avatar:      { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: T.white, alignItems: 'center', justifyContent: 'center' },
  avatarTxt:   { fontSize: 8, fontWeight: '800', color: T.white },
  trustTxt:    { fontSize: W > 768 ? 11 : 9.5, color: T.textSub, fontWeight: '500', flex: 1 },

  // Networks
  netBanner:   {
    backgroundColor: T.navy,
    borderRadius: T.r16,
    marginHorizontal: 16,
    marginVertical: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 10,
  },
  netLabel:    { fontSize: W > 768 ? 14 : 12, fontWeight: '800', color: T.white },
  netRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  netLogos:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  netChip:     { backgroundColor: T.white, borderRadius: T.r6, paddingHorizontal: 4, paddingVertical: 2, alignItems: 'center', justifyContent: 'center', width: W > 768 ? 64 : 44, height: W > 768 ? 36 : 28 },
  netImg:      { width: '100%', height: '100%' },
  netCta:      { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.28)', borderRadius: T.r8, paddingHorizontal: 12, paddingVertical: 6 },
  netCtaTxt:   { fontSize: 10, fontWeight: '700', color: T.white },

  // Services
  svcSection:  { backgroundColor: T.bg, paddingHorizontal: 16, paddingVertical: 28 },
  sectionTag:  { fontSize: 9, fontWeight: '800', color: T.goldDk, letterSpacing: 2, textTransform: 'uppercase', textAlign: 'center', marginBottom: 8 },
  sectionTitle:{ fontSize: 21, fontWeight: '900', color: T.navy, textAlign: 'center', lineHeight: 28, marginBottom: 0 },
  sectionBar:  { width: 38, height: 3, backgroundColor: T.gold, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 20 },
  svcCard:     { backgroundColor: T.card, borderRadius: T.r16, padding: 14, borderWidth: 1, borderColor: T.gray1, shadowColor: T.navy, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  svcIcon:     { width: 44, height: 44, borderRadius: T.r12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  svcName:     { fontSize: 12, fontWeight: '800', color: T.navy, marginBottom: 4 },
  svcDesc:     { fontSize: 11, color: T.gray3, lineHeight: 16 },

  // Trust
  trustSection: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    marginHorizontal: 16,
    borderRadius: T.r16,
    marginVertical: 14,
  },
  trustSectionRow:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  trustLeft:   { width: 90, marginRight: 10, alignItems: 'center', justifyContent: 'center' },
  trustRight:  { flex: 1, flexDirection: 'column' },
  trustTitle:  { fontSize: W > 768 ? 20 : 15, fontWeight: '900', color: T.white, marginBottom: 4 },
  trustDesc:   { fontSize: W > 768 ? 12 : 10.5, color: 'rgba(255,255,255,0.65)', marginBottom: 8, lineHeight: 15 },
  trustBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  trustBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trustBadgeTxt:{ fontSize: 9.5, fontWeight: '600', color: T.white },

  // Download
  dlSection:   { backgroundColor: T.bg, paddingHorizontal: 16, paddingVertical: 20 },
  dlRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  dlLeft:      { width: '65%', flexShrink: 1, paddingRight: 6 },
  dlRight:     { width: '32%', alignItems: 'center', justifyContent: 'center' },
  dlTitle:     { fontSize: W > 768 ? 22 : 16, fontWeight: '900', color: T.navy, lineHeight: W > 768 ? 30 : 21, marginBottom: 4 },
  dlDesc:      { fontSize: W > 768 ? 13 : 11, color: T.textSub, marginBottom: 12 },
  storeRow:    { flexDirection: W > 768 ? 'row' : 'column', gap: 6, width: '100%' },
  storeBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: T.navy, borderRadius: T.r8, paddingHorizontal: 10, paddingVertical: 8, width: W > 768 ? '48%' : '100%' },
  storeSml:    { fontSize: 6, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.4 },
  storeBig:    { fontSize: 10, fontWeight: '700', color: T.white },
  qrBox:       { width: 76, height: 76, backgroundColor: T.white, borderRadius: T.r12, borderWidth: 1.5, borderColor: T.gray1, alignItems: 'center', justifyContent: 'center', padding: 6, shadowColor: T.navy, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 2 },
  qrLbl:       { fontSize: 9, fontWeight: '600', color: T.gray3, marginTop: 5 },

  // Footer
  footer:      { backgroundColor: T.navy, paddingHorizontal: 16, paddingTop: 28 },
  ftBrand:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  ftBrandTxt:  { fontSize: 14, fontWeight: '900', color: T.white, lineHeight: 18 },
  ftSubTxt:    { fontSize: 9,  fontWeight: '700', color: T.gold, letterSpacing: 1.2, lineHeight: 13 },
  ftTagline:   { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 20 },
  ftGrid:      { flexDirection: 'row', gap: 12 },
  ftColHd:     { fontSize: 10, fontWeight: '800', color: T.white, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  ftLink:      { fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 7 },
  ftDivider:   { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.12)', marginTop: 20, marginBottom: 14 },
  ftCopy:      { fontSize: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'center' },
});
