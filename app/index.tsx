import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
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
  runOnJS,
} from 'react-native-reanimated';
import { supabase, processOAuthReturn } from '../services/supabase';

const { width: SW, height: SH } = Dimensions.get('window');

// Local fallback logo
const FALLBACK_LOGO = require('../assets/images/logo.png');

export default function AppIntroScreen() {
  const router = useRouter();

  const [statusText, setStatusText] = useState('Securing Connection...');
  const [adminLogo, setAdminLogo] = useState<string | null>(null);

  // Animation values
  const logoScale = useSharedValue(0.7);
  const logoOpacity = useSharedValue(0);
  const ringScale = useSharedValue(0.9);
  const ringOpacity = useSharedValue(0.35);

  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(18);

  const progress = useSharedValue(0);
  const screenOpacity = useSharedValue(1);

  // State refs to coordinate intro finish
  const sessionCheckDone = useRef(false);
  const targetRoute = useRef<'pin' | 'splash' | 'dashboard' | 'landing'>('splash');
  const timerDone = useRef(false);

  useEffect(() => {
    // 1. Initial Animations entrance
    logoScale.value = withSpring(1, { damping: 14, stiffness: 100 });
    logoOpacity.value = withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) });

    textOpacity.value = withDelay(250, withTiming(1, { duration: 750, easing: Easing.out(Easing.quad) }));
    textTranslateY.value = withSpring(0, { damping: 15, stiffness: 90 });

    // Breathing ring animation
    ringScale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.95, { duration: 1600, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    ringOpacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.25, { duration: 1600, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    // Smooth progress bar fill
    progress.value = withTiming(1, { duration: 1850, easing: Easing.out(Easing.cubic) });

    // Status text progressive updates
    const t1 = setTimeout(() => {
      setStatusText('Verifying Credentials...');
    }, 600);

    const t2 = setTimeout(() => {
      setStatusText('Loading Abu-Mafhal Gateway...');
    }, 1250);

    // 2. Fetch Cached / Cloud Admin Logo
    loadLogoConfig();

    // 3. Perform Fast Authentication Check
    checkUserSession();

    // 4. Guaranteed Intro duration timer (~2000ms for silky smooth cinematic intro)
    const introTimer = setTimeout(() => {
      timerDone.current = true;
      attemptTransition();
    }, 2000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(introTimer);
    };
  }, []);

  const loadLogoConfig = async () => {
    try {
      // Check cached logo first
      const cached = await AsyncStorage.getItem('cached_app_logo_url');
      if (cached) setAdminLogo(cached);

      // Async fetch from Supabase
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'app_logo')
        .maybeSingle();

      if (data?.value) {
        let logoUrl = null;
        if (typeof data.value === 'string') {
          if (data.value.trim().startsWith('{')) {
            try {
              const parsed = JSON.parse(data.value);
              logoUrl = parsed.url || parsed.uri || data.value;
            } catch {
              logoUrl = data.value;
            }
          } else {
            logoUrl = data.value;
          }
        } else if (typeof data.value === 'object' && data.value !== null) {
          logoUrl = (data.value as any).url || (data.value as any).uri || null;
        }

        if (logoUrl && typeof logoUrl === 'string' && logoUrl.startsWith('http')) {
          setAdminLogo(logoUrl);
          await AsyncStorage.setItem('cached_app_logo_url', logoUrl);
        }
      }
    } catch (_) {}
  };

  const checkUserSession = async () => {
    try {
      // Handle Web Platform
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const search = window.location.search || '', hash = window.location.hash || '';
        const hasAuth = (hash && hash.includes('access_token')) || (search && search.includes('code='));
        if (hasAuth) {
          await processOAuthReturn();
        }

        const hasActive = await AsyncStorage.getItem('has_active_session');
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user || hasActive === 'true') {
          targetRoute.current = 'dashboard';
        } else {
          targetRoute.current = 'landing';
        }
        sessionCheckDone.current = true;
        attemptTransition();
        return;
      }

      // Handle Native Mobile App (Play Store & iOS)
      let { data: { session } } = await supabase.auth.getSession();
      const hasActive = await AsyncStorage.getItem('has_active_session');

      // If active session flag exists, attempt graceful refresh if session object is pending
      if (!session && hasActive === 'true') {
        const refreshed = await supabase.auth.refreshSession().catch(() => ({ data: { session: null }, error: null }));
        if (refreshed?.data?.session) {
          session = refreshed.data.session;
        }
      }

      if (session?.user && hasActive === 'true') {
        // USER IS ALREADY LOGGED IN!
        // Lock app for security so PIN is required, and route DIRECTLY to PIN!
        // Splash screen is completely bypassed!
        await AsyncStorage.removeItem('app_unlocked');
        targetRoute.current = 'pin';
      } else {
        // USER IS NOT LOGGED IN!
        // Clean session keys and route directly to Splash carousel
        await AsyncStorage.removeItem('has_active_session');
        await AsyncStorage.removeItem('app_unlocked');
        await AsyncStorage.removeItem('saved_user_identifier');
        targetRoute.current = 'splash';
      }
    } catch (e) {
      console.log('Intro session notice:', e);
      targetRoute.current = 'splash';
    } finally {
      sessionCheckDone.current = true;
      attemptTransition();
    }
  };

  const attemptTransition = () => {
    // Both minimum intro animation time and session check must be completed
    if (!timerDone.current || !sessionCheckDone.current) return;

    // Smooth fade out before switching screens
    screenOpacity.value = withTiming(0, { duration: 250, easing: Easing.in(Easing.cubic) }, (finished) => {
      if (finished) {
        runOnJS(navigateNext)();
      }
    });
  };

  const navigateNext = () => {
    const route = targetRoute.current;
    if (route === 'pin') {
      router.replace('/(auth)/pin' as any);
    } else if (route === 'dashboard') {
      router.replace('/dashboard' as any);
    } else if (route === 'landing') {
      if (typeof window !== 'undefined') {
        window.location.replace('/landing.html');
      } else {
        router.replace('/splash' as any);
      }
    } else {
      router.replace('/splash' as any);
    }
  };

  // Animated styles
  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const ringAnimatedStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));

  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  const progressAnimatedStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const screenAnimatedStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
  }));

  return (
    <Animated.View style={[styles.container, screenAnimatedStyle]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Deep Luxury Midnight Sapphire Gradient */}
      <LinearGradient
        colors={['#030712', '#07132B', '#0A1C40', '#030712']}
        locations={[0, 0.35, 0.72, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Ambient Radial Golden Aura */}
      <View style={styles.ambientAura} />

      {/* Central Brand Showcase */}
      <View style={styles.centerContent}>
        {/* Animated Glow Halo */}
        <Animated.View style={[styles.haloRing, ringAnimatedStyle]} />

        {/* Brand Crest Container */}
        <Animated.View style={[styles.logoCard, logoAnimatedStyle]}>
          <Image
            source={adminLogo ? { uri: adminLogo } : FALLBACK_LOGO}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Brand Name & Tagline */}
        <Animated.View style={[styles.brandDetails, textAnimatedStyle]}>
          <Text style={styles.brandTitle}>ABU-MAFHAL HUB</Text>
          <View style={styles.pillBadge}>
            <Text style={styles.pillBadgeText}>PREMIUM DIGITAL ECOSYSTEM</Text>
          </View>
          <Text style={styles.brandSubtitle}>
            Instant VTU • Cheap Data • Utility Bills • Banking
          </Text>
        </Animated.View>
      </View>

      {/* Bottom Progress & Banking Security Badge */}
      <Animated.View style={[styles.bottomContainer, textAnimatedStyle]}>
        {/* Modern Minimal Progress Line */}
        <View style={styles.progressBarBg}>
          <Animated.View style={[styles.progressBarFill, progressAnimatedStyle]} />
        </View>

        <Text style={styles.statusText}>{statusText}</Text>

        {/* Security Shield Tag */}
        <View style={styles.securityTag}>
          <Ionicons name="shield-checkmark" size={14} color="#F5A623" style={{ marginRight: 6 }} />
          <Text style={styles.securityText}>256-Bit SSL Bank-Grade Encryption</Text>
        </View>

        <Text style={styles.versionText}>v1.0.7 • Powered by Abu-Mafhal Tech</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030712',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 56,
  },
  ambientAura: {
    position: 'absolute',
    top: SH * 0.28,
    width: SW * 0.9,
    height: SW * 0.9,
    borderRadius: (SW * 0.9) / 2,
    backgroundColor: 'rgba(245, 166, 35, 0.08)',
    alignSelf: 'center',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  haloRing: {
    position: 'absolute',
    width: 154,
    height: 154,
    borderRadius: 77,
    borderWidth: 2,
    borderColor: 'rgba(245, 166, 35, 0.55)',
    backgroundColor: 'rgba(245, 166, 35, 0.04)',
  },
  logoCard: {
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: '#091630',
    borderWidth: 2,
    borderColor: 'rgba(245, 166, 35, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#F5A623',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 12,
  },
  logoImage: {
    width: 86,
    height: 86,
  },
  brandDetails: {
    alignItems: 'center',
    marginTop: 26,
    paddingHorizontal: 24,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2.2,
    textAlign: 'center',
  },
  pillBadge: {
    marginTop: 8,
    backgroundColor: 'rgba(245, 166, 35, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.3)',
  },
  pillBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F5A623',
    letterSpacing: 1.5,
  },
  brandSubtitle: {
    fontSize: 13,
    color: '#8E9EB8',
    marginTop: 10,
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  bottomContainer: {
    width: '85%',
    alignItems: 'center',
  },
  progressBarBg: {
    width: '100%',
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#F5A623',
    borderRadius: 2,
  },
  statusText: {
    fontSize: 12,
    color: '#A0B2CD',
    fontWeight: '500',
    marginBottom: 14,
    letterSpacing: 0.4,
  },
  securityTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 8,
  },
  securityText: {
    fontSize: 11,
    color: '#D0D9E7',
    fontWeight: '600',
  },
  versionText: {
    fontSize: 10,
    color: '#5C6D87',
    fontWeight: '500',
  },
});
