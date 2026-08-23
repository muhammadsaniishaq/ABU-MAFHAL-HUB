import React, { useEffect, useRef, useState } from 'react';
import { useAppSettings } from '../hooks/useAppSettings';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Dimensions,
  StyleSheet,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase, processOAuthReturn } from '../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const { width: W, height: H } = Dimensions.get('window');

// ─── Modern Premium Design Tokens ──────────────────────────────────────────────
const T = {
  bgDark:     '#020617',
  bgMid:      '#0F172A',
  bgCard:     'rgba(15, 23, 42, 0.75)',
  goldPrimary:'#F59E0B',
  goldBright: '#F7C948',
  goldDark:   '#D97706',
  white:      '#FFFFFF',
  textSub:    '#94A3B8',
  textMuted:  '#64748B',
  glassBorder:'rgba(245, 158, 11, 0.3)',
};

function useReveal(delay = 0) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(28)).current;
  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 700, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 700, delay, useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [delay]);
  return { opacity, transform: [{ translateY }] };
}

function useFloat(delay = 0, duration = 3500) {
  const translateY = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, { toValue: -14, duration, delay, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [delay, duration]);
  return { transform: [{ translateY }] };
}

function useRotate(duration = 22000, reverse = false) {
  const rotate = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(rotate, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true })
    );
    anim.start();
    return () => anim.stop();
  }, [duration]);
  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: reverse ? ['360deg', '0deg'] : ['0deg', '360deg'],
  });
  return { transform: [{ rotate: spin }] };
}

function usePulse(duration = 2000) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.08, duration, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [duration]);
  return { transform: [{ scale }] };
}

export default function Splash() {
  const { settings } = useAppSettings();
  const router = useRouter();
  const { ref } = useLocalSearchParams<{ ref?: string }>();
  
  const [isReady, setIsReady] = useState(true);
  const [partners, setPartners] = useState<any[]>([]);

  useEffect(() => {
    let isSubscribed = true;

    const checkSessionAndNavigate = async () => {
      try {
        processOAuthReturn().catch(() => {});

        const hasActive = await AsyncStorage.getItem('has_active_session');
        const unlocked = await AsyncStorage.getItem('app_unlocked');

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && isSubscribed) {
          await AsyncStorage.setItem('has_active_session', 'true');
          
          let localPin = Platform.OS === 'web'
            ? await AsyncStorage.getItem(`user_transaction_pin_${session.user.id}`) || await AsyncStorage.getItem('user_transaction_pin')
            : await SecureStore.getItemAsync(`user_transaction_pin_${session.user.id}`) || await SecureStore.getItemAsync('user_transaction_pin');

          if (!localPin) {
            (async () => {
              try {
                const { data } = await supabase.from('profiles').select('transaction_pin').eq('id', session.user.id).maybeSingle();
                if (data?.transaction_pin) {
                  const validPin = String(data.transaction_pin);
                  if (Platform.OS === 'web') await AsyncStorage.setItem(`user_transaction_pin_${session.user.id}`, validPin);
                  else await SecureStore.setItemAsync(`user_transaction_pin_${session.user.id}`, validPin);
                  if (unlocked === 'true') router.replace('/dashboard' as any);
                  else router.replace('/pin' as any);
                } else {
                  router.replace('/pin-setup' as any);
                }
              } catch (err) {
                router.replace('/dashboard' as any);
              }
            })();
            return;
          }

          if (unlocked === 'true') {
            router.replace('/dashboard' as any);
          } else {
            router.replace('/pin' as any);
          }
        } else if (Platform.OS === 'web' && typeof window !== 'undefined' && isSubscribed) {
          if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
            window.location.replace('/landing.html');
          }
        }
      } catch (e) {
        console.log('Splash session check notice:', e);
      }
    };

    checkSessionAndNavigate();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user && isSubscribed) {
        checkSessionAndNavigate();
      }
    });

    return () => {
      isSubscribed = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const fetchPartners = async () => {
      try {
        const { data } = await supabase
          .from('partners')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });
        if (data && data.length > 0) setPartners(data);
      } catch (e) {}
    };
    fetchPartners();
  }, []);

  useEffect(() => {
    if (ref) {
      router.replace(`/(auth)/signup?ref=${ref}`);
      return;
    }
    setIsReady(true);
  }, [ref]);

  const r1 = useReveal(150);
  const r2 = useReveal(350);
  const r3 = useReveal(550);
  const r4 = useReveal(750);

  const float1 = useFloat(0, 3000);
  const float2 = useFloat(400, 3800);
  const float3 = useFloat(800, 3200);
  const float4 = useFloat(1200, 4200);

  const rotateClockwise = useRotate(22000, false);
  const rotateCounterClockwise = useRotate(18000, true);
  const pulseAnim = usePulse(2500);

  const scrollAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (partners.length > 0) {
      scrollAnim.setValue(0);
      const anim = Animated.loop(
        Animated.timing(scrollAnim, {
          toValue: 1,
          duration: Math.max(10000, partners.length * 6000),
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      anim.start();
      return () => anim.stop();
    }
  }, [partners.length]);

  const translateX = scrollAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [W, -W * 4]
  });

  if (!isReady) return <View style={{ flex: 1, backgroundColor: T.bgDark }} />;

  return (
    <View style={s.container}>
      <StatusBar style="light" />
      
      {/* Dynamic Deep Navy Gradient Background */}
      <LinearGradient 
        colors={['#020617', '#0F172A', '#020617']} 
        start={{ x: 0, y: 0 }} 
        end={{ x: 1, y: 1 }} 
        style={StyleSheet.absoluteFillObject} 
      />
      
      {/* Multi-layered Glowing Light Orbs & Wave Gradients */}
      <View style={s.glowTopLeft} />
      <View style={s.glowBottomRight} />
      <View style={s.waveRing1} />
      <View style={s.waveRing2} />
      <View style={s.waveRing3} />

      {/* Floating Sparkle Particles */}
      <Animated.View style={[s.particle, { top: '14%', left: '12%', width: 8, height: 8 }, float1]} />
      <Animated.View style={[s.particle, { top: '32%', right: '10%', width: 6, height: 6, opacity: 0.8 }, float2]} />
      <Animated.View style={[s.particle, { top: '50%', left: '8%', width: 10, height: 10, opacity: 0.5 }, float3]} />
      <Animated.View style={[s.particle, { bottom: '28%', right: '18%', width: 7, height: 7 }, float4]} />

      <SafeAreaView style={{ flex: 1 }}>
        <View style={s.content}>

          {/* Top Security & Convenience Badge */}
          <Animated.View style={[s.topBadgeWrapper, r1]}>
            <View style={s.topBadgePill}>
              <Ionicons name="shield-checkmark" size={14} color={T.goldBright} />
              <Text style={s.topBadgeText}>INSTANT & 100% SECURE VTU</Text>
            </View>
          </Animated.View>

          {/* Logo & Brand Header */}
          <Animated.View style={[s.logoWrapper, r1]}>
            <View style={s.logoContainer}>
              {/* Outer Dashed Rotating Aura (Counter-Clockwise) */}
              <Animated.View style={[s.logoOuterDashedRing, rotateCounterClockwise]} />
              
              {/* Inner Dashed Rotating Aura (Clockwise) */}
              <Animated.View style={[s.logoInnerDashedRing, rotateClockwise]} />

              {/* Pulsing Core Circle */}
              <Animated.View style={[s.logoCoreCircle, pulseAnim]}>
                <View style={s.logoGlassInner}>
                  <Image 
                    source={require('../assets/images/logo.png')} 
                    style={s.logoImg} 
                    resizeMode="contain" 
                  />
                </View>
              </Animated.View>
            </View>

            {/* Brand Title & Tagline */}
            <Text style={s.brandTitle}>ABU MAFHAL</Text>
            
            <View style={s.subWrapper}>
              <View style={s.subLine} />
              <Ionicons name="diamond" size={11} color={T.goldBright} style={{ marginHorizontal: 8 }} />
              <Text style={s.brandSub}>SUB</Text>
              <Ionicons name="diamond" size={11} color={T.goldBright} style={{ marginHorizontal: 8 }} />
              <View style={s.subLine} />
            </View>

            <Text style={s.tagline}>One Sub. Endless Possibilities.</Text>
          </Animated.View>

          <View style={{ flex: 1 }} />

          {/* Bottom Interactive Area */}
          <Animated.View style={[s.bottomSection, r2]}>
            
            {/* Carousel Page Dots */}
            <View style={s.dotsContainer}>
              <View style={[s.dot, { backgroundColor: T.goldBright, width: 22 }]} />
              <View style={[s.dot, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />
              <View style={[s.dot, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />
            </View>

            {/* Service Icons Grid (Frosted Glass Cards) */}
            <Animated.View style={[s.grid, r3]}>
              {[
                { icon: 'phone-portrait-outline', label: 'Airtime' },
                { icon: 'wifi-outline', label: 'Data' },
                { icon: 'document-text-outline', label: 'Bills' },
                { icon: 'flash-outline', label: 'Electricity' },
                { icon: 'tv-outline', label: 'Cable TV' },
              ].map((item, i) => (
                <View key={i} style={s.gridItem}>
                  <View style={s.iconBox}>
                    <Ionicons name={item.icon as any} size={20} color={T.goldBright} />
                  </View>
                  <Text style={s.iconLabel}>{item.label}</Text>
                </View>
              ))}
            </Animated.View>

            {/* Trust Motto */}
            <Animated.Text style={[s.footerText, r3]}>
              Fast. <Text style={{ color: T.goldBright }}>Secure.</Text> Reliable Telecom.
            </Animated.Text>

            {/* Auto Scrolling Partner Badges */}
            {partners.length > 0 && (
              <Animated.View style={[r3, { overflow: 'hidden', height: 38, width: '100%', marginBottom: 20 }]}>
                <Animated.View style={{ flexDirection: 'row', transform: [{ translateX }] }}>
                  {[...partners, ...partners, ...partners, ...partners, ...partners].map((p, i) => (
                    <View key={i} style={s.partnerPill}>
                      {p.logo_url ? (
                         <Image source={{ uri: p.logo_url }} style={s.partnerLogo} resizeMode="contain" />
                      ) : (
                         <Ionicons name="business" size={15} color={T.goldBright} style={{ marginRight: 6 }} />
                      )}
                      <Text style={s.partnerText}>{p.name}</Text>
                    </View>
                  ))}
                </Animated.View>
              </Animated.View>
            )}

            {/* Action Buttons: Get Started & Sign In */}
            <Animated.View style={[r4, { width: '100%', gap: 12 }]}>
              
              {/* Primary Registration Button */}
              <TouchableOpacity 
                style={s.btnPrimary}
                onPress={() => router.push('/signup' as any)}
                activeOpacity={0.88}
              >
                <LinearGradient 
                  colors={[T.goldPrimary, T.goldBright, T.goldDark]} 
                  start={{ x: 0, y: 0 }} 
                  end={{ x: 1, y: 0 }} 
                  style={s.btnGradient}
                >
                  <Text style={s.btnPrimaryText}>Fara Amfani (Register)</Text>
                  <Ionicons name="arrow-forward" size={18} color="#0F172A" />
                </LinearGradient>
              </TouchableOpacity>

              {/* Secondary Sign In Button */}
              <TouchableOpacity 
                style={s.btnSecondary}
                onPress={() => router.push('/login' as any)}
                activeOpacity={0.8}
              >
                <Text style={s.btnSecondaryText}>Shiga Asusu (Sign In)</Text>
                <Ionicons name="log-in-outline" size={16} color={T.goldBright} />
              </TouchableOpacity>

            </Animated.View>

          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ─── Stylesheet ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: T.bgDark 
  },
  
  // Background Glowing Orbs & Decorative Rings
  glowTopLeft: {
    position: 'absolute',
    top: '-12%',
    left: '-20%',
    width: W * 0.9,
    height: W * 0.9,
    borderRadius: W * 0.45,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  glowBottomRight: {
    position: 'absolute',
    bottom: '-10%',
    right: '-25%',
    width: W * 1.1,
    height: W * 1.1,
    borderRadius: W * 0.55,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
  },
  waveRing1: { 
    position: 'absolute', 
    top: '-8%', 
    left: '-45%', 
    width: W * 1.9, 
    height: 420, 
    borderRadius: W, 
    borderWidth: 1.5, 
    borderColor: 'rgba(245, 158, 11, 0.18)', 
    transform: [{ rotate: '-15deg' }] 
  },
  waveRing2: { 
    position: 'absolute', 
    top: '6%', 
    left: '-35%', 
    width: W * 1.7, 
    height: 360, 
    borderRadius: W, 
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.06)', 
    transform: [{ rotate: '-10deg' }] 
  },
  waveRing3: { 
    position: 'absolute', 
    bottom: '-12%', 
    right: '-45%', 
    width: W * 1.9, 
    height: 480, 
    borderRadius: W, 
    borderWidth: 1.5, 
    borderColor: 'rgba(245, 158, 11, 0.12)', 
    transform: [{ rotate: '25deg' }] 
  },

  particle: {
    position: 'absolute',
    backgroundColor: T.goldBright,
    borderRadius: 50,
    shadowColor: T.goldBright,
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 6
  },

  content: { 
    flex: 1, 
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 20, 
    justifyContent: 'space-between', 
    zIndex: 10 
  },

  // Top Badge
  topBadgeWrapper: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  topBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
  },
  topBadgeText: {
    color: T.goldBright,
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 1,
  },

  // Animated Logo Circle & Ring Structure
  logoWrapper: { 
    alignItems: 'center', 
    marginTop: '6%', 
    zIndex: 20 
  },
  logoContainer: {
    width: 156,
    height: 156,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  logoOuterDashedRing: {
    position: 'absolute',
    width: 156,
    height: 156,
    borderRadius: 78,
    borderWidth: 1.5,
    borderColor: 'rgba(245, 158, 11, 0.45)',
    borderStyle: 'dashed',
  },
  logoInnerDashedRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    borderStyle: 'dashed',
  },
  logoCoreCircle: {
    width: 122,
    height: 122,
    borderRadius: 61,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(245, 158, 11, 0.5)',
    shadowColor: T.goldBright,
    shadowOpacity: 0.7,
    shadowRadius: 20,
    elevation: 15,
  },
  logoGlassInner: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: T.goldDark,
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  logoImg: { 
    width: 72, 
    height: 72 
  },

  // Typography
  brandTitle: { 
    color: T.white, 
    fontSize: 28, 
    fontWeight: '900', 
    letterSpacing: 2, 
    textShadowColor: 'rgba(0,0,0,0.6)', 
    textShadowOffset: { width: 0, height: 2 }, 
    textShadowRadius: 6 
  },
  subWrapper: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: 8, 
    marginBottom: 4 
  },
  subLine: { 
    height: 2, 
    width: 44, 
    backgroundColor: 'rgba(245, 158, 11, 0.7)', 
    borderRadius: 2 
  },
  brandSub: { 
    color: T.goldBright, 
    fontSize: 21, 
    fontWeight: '900', 
    letterSpacing: 8,
    textShadowColor: 'rgba(245, 158, 11, 0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  tagline: { 
    color: 'rgba(255, 255, 255, 0.88)', 
    fontSize: 13.5, 
    marginTop: 10, 
    fontWeight: '600', 
    letterSpacing: 0.3 
  },

  // Bottom Area & Grid
  bottomSection: { 
    alignItems: 'center', 
    paddingBottom: 10, 
    zIndex: 20 
  },
  dotsContainer: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center',
    gap: 6, 
    marginBottom: 28 
  },
  dot: { 
    height: 6, 
    width: 6, 
    borderRadius: 3 
  },

  grid: { 
    flexDirection: 'row', 
    justify: 'space-between', 
    width: '100%', 
    marginBottom: 26 
  },
  gridItem: { 
    alignItems: 'center', 
    gap: 8 
  },
  iconBox: {
    width: 48, 
    height: 48, 
    borderRadius: 14,
    borderWidth: 1, 
    borderColor: 'rgba(245, 158, 11, 0.35)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center', 
    justifyContent: 'center',
    shadowColor: T.goldBright, 
    shadowOpacity: 0.25, 
    shadowRadius: 10, 
    elevation: 4
  },
  iconLabel: { 
    color: T.white, 
    fontSize: 10, 
    fontWeight: '700',
    letterSpacing: 0.2
  },

  footerText: { 
    textAlign: 'center', 
    color: 'rgba(255, 255, 255, 0.9)', 
    fontSize: 13, 
    fontWeight: '700', 
    marginBottom: 22 
  },

  partnerPill: {
    flexDirection: 'row', 
    alignItems: 'center', 
    marginRight: 24, 
    backgroundColor: 'rgba(255, 255, 255, 0.06)', 
    paddingHorizontal: 14, 
    paddingVertical: 6, 
    borderRadius: 20, 
    borderWidth: 1, 
    borderColor: 'rgba(245, 158, 11, 0.25)'
  },
  partnerLogo: {
    width: 18, 
    height: 18, 
    borderRadius: 4, 
    marginRight: 8
  },
  partnerText: {
    color: 'rgba(255, 255, 255, 0.9)', 
    fontSize: 11, 
    fontWeight: '800', 
    textTransform: 'uppercase', 
    letterSpacing: 1
  },

  // Buttons
  btnPrimary: { 
    width: '100%',
    borderRadius: 18, 
    overflow: 'hidden',
    shadowColor: T.goldBright, 
    shadowOpacity: 0.45, 
    shadowRadius: 16, 
    shadowOffset: { width: 0, height: 6 },
    elevation: 9
  },
  btnGradient: {
    height: 52,
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 8, 
    paddingHorizontal: 24, 
  },
  btnPrimaryText: { 
    color: '#0F172A', 
    fontSize: 15, 
    fontWeight: '900',
    letterSpacing: 0.3
  },
  btnSecondary: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20, 
    borderRadius: 16,
    borderWidth: 1, 
    borderColor: 'rgba(245, 158, 11, 0.4)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  btnSecondaryText: { 
    color: T.goldBright, 
    fontSize: 13.5, 
    fontWeight: '800' 
  },
});
