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
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, processOAuthReturn } from '../services/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: W, height: H } = Dimensions.get('window');

export default function SplashScreen() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  // Animation values
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(24)).current;
  const haloPulse = useRef(new Animated.Value(1)).current;
  const orbFloat = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Entrance choreography
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(contentFade, {
        toValue: 1,
        duration: 650,
        delay: 200,
        useNativeDriver: true,
      }),
      Animated.spring(contentSlide, {
        toValue: 0,
        friction: 7,
        tension: 45,
        delay: 200,
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
          duration: 2600,
          useNativeDriver: true,
        }),
        Animated.timing(orbFloat, {
          toValue: 0,
          duration: 2600,
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

      {/* Deep Royal Cosmic Background */}
      <LinearGradient
        colors={['#010514', '#040d26', '#07153d', '#01081c']}
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
          {/* HIGH DEFINITION LUXURY AM EMBLEM */}
          <Animated.View
            style={[
              s.logoWrapper,
              {
                opacity: logoOpacity,
                transform: [{ scale: logoScale }],
              },
            ]}
          >
            {/* Soft Golden Ambient Halo Ring */}
            <Animated.View
              style={[
                s.haloGlow,
                { transform: [{ scale: haloPulse }] },
              ]}
            />

            {/* Luxury Glassmorphic Beveled Frame */}
            <View style={s.emblemFrame}>
              <LinearGradient
                colors={['#0e2254', '#061330', '#01081c']}
                style={s.emblemGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Image
                  source={require('../assets/images/logo.png')}
                  style={s.emblemImage}
                  resizeMode="contain"
                />
              </LinearGradient>
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
              <View style={s.brandBadge}>
                <Text style={s.brandBadgeText}>SUB</Text>
              </View>
            </View>

            <Text style={s.brandSubtitle}>
              Premium Automated Telecom & Smart Financial Hub
            </Text>

            {/* SLEEK TRUST & VALUE CHIPS */}
            <View style={s.featureRow}>
              <View style={s.featureChip}>
                <Ionicons name="flash" size={11} color="#f5a623" />
                <Text style={s.featureChipText}>Instant VTU</Text>
              </View>
              <View style={s.featureChip}>
                <Ionicons name="wifi" size={11} color="#38bdf8" />
                <Text style={s.featureChipText}>5G Data</Text>
              </View>
              <View style={s.featureChip}>
                <Ionicons name="shield-checkmark" size={11} color="#10b981" />
                <Text style={s.featureChipText}>256-Bit SSL</Text>
              </View>
            </View>
          </Animated.View>

          {/* ACTION BUTTONS OR SLEEK LOADING STATUS */}
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
              <View style={s.loadingCard}>
                <ActivityIndicator size="small" color="#f5a623" />
                <View style={s.loadingTextWrap}>
                  <Text style={s.loadingTitle}>Initializing Secure Session</Text>
                  <Text style={s.loadingSubtitle}>Connecting to Abu Mafhal Gateway...</Text>
                </View>
              </View>
            ) : (
              <View style={s.buttonGroup}>
                {/* Primary Metallic Gold CTA */}
                <TouchableOpacity
                  onPress={() => router.push('/(auth)/login')}
                  style={s.primaryBtn}
                  activeOpacity={0.88}
                >
                  <LinearGradient
                    colors={['#f5a623', '#d97706', '#b45309']}
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
            <Ionicons name="shield-checkmark" size={13} color="#10b981" />
            <Text style={s.footerBadgeText}>Bank-Grade 256-Bit SSL • NDPA Protected</Text>
          </View>
          <Text style={s.versionText}>Abu Mafhal Hub • Version 1.0.0</Text>
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
    backgroundColor: 'rgba(245, 166, 35, 0.12)',
  },
  glowOrbBottom: {
    position: 'absolute',
    bottom: -80,
    left: -60,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
  },
  glowOrbCenter: {
    position: 'absolute',
    top: H * 0.35,
    left: W * 0.25,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(14, 165, 233, 0.06)',
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
    marginBottom: 24,
    position: 'relative',
  },
  haloGlow: {
    position: 'absolute',
    width: 146,
    height: 146,
    borderRadius: 73,
    backgroundColor: 'rgba(245, 166, 35, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.3)',
    shadowColor: '#f5a623',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 25,
    elevation: 10,
  },
  emblemFrame: {
    width: 124,
    height: 124,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 166, 35, 0.45)',
    shadowColor: '#f5a623',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 12,
  },
  emblemGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblemImage: {
    width: 110,
    height: 110,
  },
  typographyBox: {
    alignItems: 'center',
    marginBottom: 26,
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
  brandBadge: {
    backgroundColor: '#f5a623',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  brandBadgeText: {
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
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  featureChipText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
  },
  actionArea: {
    width: '100%',
    maxWidth: 340,
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  loadingTextWrap: {
    flex: 1,
  },
  loadingTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  loadingSubtitle: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 1,
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
