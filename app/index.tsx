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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../services/supabase';

const { width: W, height: H } = Dimensions.get('window');

const T = {
  navy:    '#030C22',
  navyMid: '#08183B',
  gold:    '#F7C948',
  goldDk:  '#B8860B',
  white:   '#FFFFFF',
  textSub: '#A0B0D0',
};

function useReveal(delay = 0) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 800, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 800, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return { opacity, transform: [{ translateY }] };
}

function useFloat(delay = 0, duration = 3000) {
  const translateY = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, { toValue: -15, duration, delay, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return { transform: [{ translateY }] };
}

function useRotate(duration = 20000) {
  const rotate = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(rotate, { toValue: 1, duration, useNativeDriver: true })
    ).start();
  }, []);
  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });
  return { transform: [{ rotate: spin }] };
}

export default function Splash() {
  const { settings } = useAppSettings();
  const router = useRouter();
  const { ref } = useLocalSearchParams<{ ref?: string }>();
  
  const [isReady, setIsReady] = useState(false);
  const [partners, setPartners] = useState<any[]>([]);

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
      router.replace(`/auth/login?ref=${ref}`);
    } else {
      setIsReady(true);
    }
  }, [ref]);

  const r1 = useReveal(200);
  const r2 = useReveal(400);
  const r3 = useReveal(600);
  const r4 = useReveal(800);

  const float1 = useFloat(0, 3000);
  const float2 = useFloat(500, 4000);
  const float3 = useFloat(1000, 3500);
  const float4 = useFloat(1500, 4500);
  const rotateAnim = useRotate();

  const scrollAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (partners.length > 0) {
      Animated.loop(
        Animated.timing(scrollAnim, {
          toValue: 1,
          duration: partners.length * 4000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    }
  }, [partners.length]);

  const translateX = scrollAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [W, -W * 2] 
  });

  if (!isReady) return <View style={{ flex: 1, backgroundColor: T.navy }} />;

  return (
    <View style={s.container}>
      <StatusBar style="light" />
      
      {/* Background Gradients */}
      <LinearGradient colors={['#030B1C', '#0A1E4A', '#030B1C']} style={StyleSheet.absoluteFillObject} />
      
      {/* Multiple Decorative Swirls simulating the rich gold/blue waves */}
      <View style={s.glow2} />
      <View style={s.swirl1} />
      <View style={s.swirl2} />
      <View style={s.swirl3} />
      <View style={s.swirl4} />
      <View style={s.glow1} />

      {/* Floating Particles for extra decoration */}
      <Animated.View style={[s.particle, { top: '15%', left: '15%', width: 8, height: 8 }, float1]} />
      <Animated.View style={[s.particle, { top: '35%', right: '12%', width: 6, height: 6, opacity: 0.8 }, float2]} />
      <Animated.View style={[s.particle, { top: '55%', left: '8%', width: 10, height: 10, opacity: 0.6 }, float3]} />
      <Animated.View style={[s.particle, { bottom: '25%', right: '20%', width: 7, height: 7 }, float4]} />

      <SafeAreaView style={{ flex: 1 }}>
        <View style={s.content}>
          {/* Logo Area with Rich Decorations Restored */}
          <Animated.View style={[s.logoWrapper, r1]}>
            <View style={s.logoCircle}>
              <Animated.View style={[s.logoDashedRing, rotateAnim]} />
              <View style={s.logoInnerCircle}>
                <Image 
                  source={require('../assets/images/logo.png')} 
                  style={s.logoImg} 
                  resizeMode="contain" 
                />
              </View>
            </View>
            <Text style={s.brandTitle}>ABU MAFHAL</Text>
            <View style={s.subWrapper}>
              <View style={s.subLine} />
              <Ionicons name="diamond" size={10} color={T.gold} style={{ marginHorizontal: 8 }} />
              <Text style={s.brandSub}>SUB</Text>
              <Ionicons name="diamond" size={10} color={T.gold} style={{ marginHorizontal: 8 }} />
              <View style={s.subLine} />
            </View>
            <Text style={s.tagline}>One Sub. Endless Possibilities.</Text>
          </Animated.View>

          <View style={{ flex: 1 }} />

          {/* Bottom Area */}
          <Animated.View style={[s.bottomSection, r2]}>
            {/* Dots */}
            <View style={s.dotsContainer}>
              <View style={[s.dot, { backgroundColor: T.gold }]} />
              <View style={[s.dot, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />
              <View style={[s.dot, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />
            </View>

            {/* Service Icons Grid */}
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
                    <Ionicons name={item.icon as any} size={18} color={T.gold} />
                  </View>
                  <Text style={s.iconLabel}>{item.label}</Text>
                </View>
              ))}
            </Animated.View>

            <Animated.Text style={[s.footerText, r3]}>
              Fast. <Text style={{ color: T.gold }}>Secure.</Text> Reliable.
            </Animated.Text>

            {/* Auto Scrolling Partners (Small) */}
            {partners.length > 0 && (
              <Animated.View style={[r3, { overflow: 'hidden', height: 24, width: '100%', marginBottom: 16 }]}>
                <Animated.View style={{ flexDirection: 'row', transform: [{ translateX }] }}>
                  {[...partners, ...partners, ...partners].map((p, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 24 }}>
                      {p.logo_url ? (
                         <Image source={{ uri: p.logo_url }} style={{ width: 14, height: 14, borderRadius: 4, marginRight: 6 }} resizeMode="contain" />
                      ) : (
                         <Ionicons name="business" size={12} color={T.gold} style={{ marginRight: 6 }} />
                      )}
                      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '700', textTransform: 'uppercase' }}>
                        {p.name}
                      </Text>
                    </View>
                  ))}
                </Animated.View>
              </Animated.View>
            )}

            {/* Get Started Button */}
            <Animated.View style={r4}>
              <TouchableOpacity 
                style={s.btn}
                onPress={() => router.push('/onboarding')}
                activeOpacity={0.9}
              >
                <Text style={s.btnText}>Get Started</Text>
                <Ionicons name="arrow-forward" size={15} color={T.navy} />
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.navy },
  
  // Rich Decorations
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

  content: { flex: 1, padding: 24, justifyContent: 'space-between', zIndex: 10 },
  
  // Logo Adjustments (BEAUTIFUL BOLD DECORATIONS)
  logoWrapper: { alignItems: 'center', marginTop: '12%', zIndex: 20 },
  logoCircle: { 
    width: 140, height: 140, borderRadius: 70, 
    backgroundColor: 'rgba(10, 25, 49, 0.6)', 
    alignItems: 'center', justifyContent: 'center', 
    borderWidth: 2, borderColor: 'rgba(245, 166, 35, 0.4)', 
    marginBottom: 16, 
    shadowColor: '#f5a623', shadowOpacity: 0.8, shadowRadius: 20, elevation: 15 
  },
  logoDashedRing: {
    position: 'absolute',
    width: 156, height: 156, borderRadius: 78,
    borderWidth: 1.5, borderColor: 'rgba(247, 201, 72, 0.4)',
    borderStyle: 'dashed',
  },
  logoInnerCircle: {
    width: 116, height: 116, borderRadius: 58,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#d4890e', 
    shadowColor: '#ffffff', shadowOpacity: 0.5, shadowRadius: 10, elevation: 10
  },
  logoImg: { width: 76, height: 76 },

  brandTitle: { color: T.white, fontSize: 26, fontWeight: '900', letterSpacing: 1.5, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  
  // New SUB Decorations
  subWrapper: { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 4 },
  subLine: { height: 2, width: 40, backgroundColor: 'rgba(247, 201, 72, 0.6)', borderRadius: 2 },
  brandSub: { 
    color: '#f5a623', 
    fontSize: 20, 
    fontWeight: '900', 
    letterSpacing: 8,
    textShadowColor: 'rgba(245, 166, 35, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  
  tagline: { color: T.white, fontSize: 13, marginTop: 12, fontWeight: '500', opacity: 0.9 },

  bottomSection: { alignItems: 'center', paddingBottom: 10, zIndex: 20 },
  dotsContainer: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 35 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  
  grid: { 
    flexDirection: 'row', justifyContent: 'space-between', 
    width: '100%', marginBottom: 35 
  },
  gridItem: { alignItems: 'center', gap: 10 },
  iconBox: {
    width: 44, height: 44, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(247, 201, 72, 0.3)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#F7C948', shadowOpacity: 0.15, shadowRadius: 8, elevation: 3
  },
  iconLabel: { color: T.white, fontSize: 9.5, fontWeight: '600' },
  
  footerText: { textAlign: 'center', color: T.white, fontSize: 13, fontWeight: '700', marginBottom: 25 },

  btn: { 
    backgroundColor: T.gold, flexDirection: 'row', alignItems: 'center', gap: 8, 
    paddingHorizontal: 32, paddingVertical: 14, borderRadius: 18, 
    elevation: 8, shadowColor: T.gold, shadowOpacity: 0.4, shadowRadius: 15, shadowOffset: { width: 0, height: 6 } 
  },
  btnText: { color: T.navy, fontSize: 14, fontWeight: '900' },
});
