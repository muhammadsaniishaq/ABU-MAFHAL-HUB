import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  Animated,
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, processOAuthReturn } from '../services/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: W, height: H } = Dimensions.get('window');

export default function SplashScreen() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  // Animation values
  const logoScale = useRef(new Animated.Value(0.75)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(30)).current;
  const haloPulse = useRef(new Animated.Value(1)).current;
  const haloRotate = useRef(new Animated.Value(0)).current;
  const orbFloat = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Entrance choreography
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 5,
        tension: 45,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(contentFade, {
        toValue: 1,
        duration: 800,
        delay: 250,
        useNativeDriver: true,
      }),
      Animated.spring(contentSlide, {
        toValue: 0,
        friction: 7,
        tension: 40,
        delay: 250,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Halo breathing pulse loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(haloPulse, {
          toValue: 1.08,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(haloPulse, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 3. Ambient float loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(orbFloat, {
          toValue: 12,
          duration: 2400,
          useNativeDriver: true,
        }),
        Animated.timing(orbFloat, {
          toValue: 0,
          duration: 2400,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Check existing session
    checkAuthSession();
  }, []);

  const checkAuthSession = async () => {
    try {
      // On web, check if returning from OAuth (hash token or auth code)
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const search = window.location.search || '';
        const hash = window.location.hash || '';
        const hasAuthParams = (hash && hash.includes('access_token')) || (search && search.includes('code='));

        if (hasAuthParams) {
          const ua = (window.navigator?.userAgent || '').toLowerCase();
          const isMobile = /android|iphone|ipad|ipod/.test(ua);
          if (isMobile) {
            const targetAppUrl = `abumafhalsub://login${search}${hash}`;
            window.location.href = targetAppUrl;
            router.replace('/auth/callback' as any);
            return;
          }
          await processOAuthReturn();
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      const unlockedFlag = await AsyncStorage.getItem('app_unlocked');

      if (session?.user) {
        // Genuine verified Supabase session exists
        setTimeout(() => {
          if (unlockedFlag === 'true') {
            router.replace('/dashboard' as any);
          } else {
            router.replace('/pin' as any);
          }
        }, 500);
      } else {
        // No valid session: purge stale flags to prevent redirect loops
        await AsyncStorage.removeItem('has_active_session');
        await AsyncStorage.removeItem('app_unlocked');
        setChecking(false);
      }
    } catch (e) {
      await AsyncStorage.removeItem('has_active_session');
      await AsyncStorage.removeItem('app_unlocked');
      setChecking(false);
    }
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Deep Royal Cosmic Gradient Background */}
      <LinearGradient
        colors={['#010514', '#040d24', '#07153d', '#020617']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
      />

      {/* Radiant Glowing Ambient Orbs */}
      <Animated.View
        style={[
          s.glowOrbTop,
          { transform: [{ translateY: orbFloat }] },
        ]}
      />
      <Animated.View
        style={[
          s.glowOrbBottom,
          {
            transform: [
              {
                translateY: orbFloat.interpolate({
                  inputRange: [0, 12],
                  outputRange: [0, -12],
                }),
              },
            ],
          },
        ]}
      />
      <View style={s.glowOrbCenter} />

      <SafeAreaView style={s.safeArea}>
        {/* TOP STATUS BAR PILL */}
        <View style={s.topBar}>
          <View style={s.liveStatusBadge}>
            <View style={s.liveStatusDot} />
            <Text style={s.liveStatusText}>GATEWAY LIVE • 99.98% AUTOMATED</Text>
          </View>
        </View>

        {/* HERO CENTER CONTENT */}
        <View style={s.centerBox}>
          {/* LOGO WITH MULTI-TIER LUXURY HALO */}
          <Animated.View
            style={[
              s.logoWrapper,
              {
                opacity: logoOpacity,
                transform: [{ scale: logoScale }],
              },
            ]}
          >
            {/* Outer Golden Glow Ring */}
            <Animated.View
              style={[
                s.outerHaloRing,
                { transform: [{ scale: haloPulse }] },
              ]}
            />

            {/* Middle Cyber Accent Ring */}
            <View style={s.middleAccentRing}>
              {/* Glassmorphic Shield Card */}
              <View style={s.logoGlassCard}>
                <LinearGradient
                  colors={['#0e2254', '#071330']}
                  style={s.logoGradientInside}
                >
                  <Image
                    source={require('../assets/images/logo.png')}
                    style={s.logoImage}
                    resizeMode="contain"
                  />
                </LinearGradient>
              </View>
            </View>

            {/* Micro Floating Tech Badge */}
            <View style={s.shieldBadge}>
              <Ionicons name="flash" size={10} color="#060d21" />
              <Text style={s.shieldBadgeText}>5G VTU</Text>
            </View>
          </Animated.View>

          {/* BRAND HEADLINE & TAGLINE */}
          <Animated.View
            style={[
              s.typographyBox,
              {
                opacity: contentFade,
                transform: [{ translateY: contentSlide }],
              },
            ]}
          >
            <View style={s.brandRow}>
              <Text style={s.brandTitle}>ABU MAFHAL</Text>
              <View style={s.brandTagPill}>
                <Text style={s.brandTagText}>SUB</Text>
              </View>
            </View>

            <Text style={s.brandSubtitle}>
              Next-Gen Automated Telecom & Smart Utility Payments
            </Text>

            {/* FEATURE PILLS GRID */}
            <View style={s.featureGrid}>
              <View style={s.featurePill}>
                <Ionicons name="cellular" size={12} color="#38bdf8" />
                <Text style={s.featurePillText}>Cheap Data</Text>
              </View>

              <View style={s.featurePill}>
                <Ionicons name="call" size={12} color="#f5a623" />
                <Text style={s.featurePillText}>Instant Airtime</Text>
              </View>

              <View style={s.featurePill}>
                <MaterialCommunityIcons name="lightning-bolt" size={12} color="#10b981" />
                <Text style={s.featurePillText}>Electric Bills</Text>
              </View>

              <View style={s.featurePill}>
                <Ionicons name="tv" size={12} color="#a855f7" />
                <Text style={s.featurePillText}>Cable TV</Text>
              </View>
            </View>
          </Animated.View>

          {/* ACTION BUTTONS OR LOADING STATUS */}
          <Animated.View
            style={[
              s.actionArea,
              {
                opacity: contentFade,
                transform: [{ translateY: contentSlide }],
              },
            ]}
          >
            {checking ? (
              <View style={s.loadingContainer}>
                <ActivityIndicator size="small" color="#f5a623" />
                <Text style={s.loadingLabel}>Securing encrypted session...</Text>
              </View>
            ) : (
              <View style={s.buttonGroup}>
                {/* Primary Gold CTA */}
                <TouchableOpacity
                  onPress={() => router.push('/(auth)/login')}
                  style={s.primaryBtn}
                  activeOpacity={0.88}
                >
                  <LinearGradient
                    colors={['#f5a623', '#e08a00', '#c26e00']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={s.primaryBtnGradient}
                  >
                    <Text style={s.primaryBtnText}>Sign In to Account</Text>
                    <View style={s.btnArrowCircle}>
                      <Ionicons name="arrow-forward" size={14} color="#040d24" />
                    </View>
                  </LinearGradient>
                </TouchableOpacity>

                {/* Secondary Glass CTA */}
                <TouchableOpacity
                  onPress={() => router.push('/(auth)/signup')}
                  style={s.secondaryBtn}
                  activeOpacity={0.8}
                >
                  <Text style={s.secondaryBtnText}>Create Free Account</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </View>

        {/* BOTTOM SECURITY ASSURANCE */}
        <View style={s.footer}>
          <View style={s.footerBadgeRow}>
            <Ionicons name="shield-checkmark-sharp" size={13} color="#10b981" />
            <Text style={s.footerBadgeText}>Bank-Grade 256-Bit SSL • NDPA Protected</Text>
          </View>
          <Text style={s.versionText}>Abu Mafhal Sub • Production v1.0.0</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#010514',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: Platform.OS === 'android' ? 24 : 10,
    paddingBottom: 16,
  },
  topBar: {
    alignItems: 'center',
    marginTop: 8,
  },
  liveStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  liveStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  liveStatusText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  glowOrbTop: {
    position: 'absolute',
    top: -60,
    right: -50,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(245, 166, 35, 0.14)',
  },
  glowOrbBottom: {
    position: 'absolute',
    bottom: -80,
    left: -60,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(37, 99, 235, 0.16)',
  },
  glowOrbCenter: {
    position: 'absolute',
    top: H * 0.35,
    left: W * 0.25,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(14, 165, 233, 0.08)',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 26,
    position: 'relative',
  },
  outerHaloRing: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(245, 166, 35, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.25)',
    shadowColor: '#f5a623',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  middleAccentRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: 'rgba(7, 21, 61, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 166, 35, 0.45)',
  },
  logoGlassCard: {
    width: 88,
    height: 88,
    borderRadius: 44,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  logoGradientInside: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 64,
    height: 64,
  },
  shieldBadge: {
    position: 'absolute',
    bottom: -6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#f5a623',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    shadowColor: '#f5a623',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 5,
  },
  shieldBadgeText: {
    color: '#040d24',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  typographyBox: {
    alignItems: 'center',
    marginBottom: 28,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  brandTitle: {
    color: '#ffffff',
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  brandTagPill: {
    backgroundColor: '#f5a623',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  brandTagText: {
    color: '#040d24',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  brandSubtitle: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 290,
    lineHeight: 19,
    marginBottom: 16,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    maxWidth: 320,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  featurePillText: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '600',
  },
  actionArea: {
    width: '100%',
    maxWidth: 340,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  loadingLabel: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '500',
  },
  buttonGroup: {
    gap: 12,
  },
  primaryBtn: {
    borderRadius: 15,
    overflow: 'hidden',
    shadowColor: '#f5a623',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  primaryBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  primaryBtnText: {
    color: '#040d24',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  btnArrowCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(4, 13, 36, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtn: {
    paddingVertical: 15,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  secondaryBtnText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  footer: {
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
  },
  footerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerBadgeText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
  versionText: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '500',
  },
});
