import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Image, StyleSheet,
  Dimensions, Animated, Platform, StatusBar, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: W, height: H } = Dimensions.get('window');

export default function SplashScreen() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  // Animations
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Entrance Animation
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(contentFade, {
        toValue: 1,
        duration: 700,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Subtle Breathing Pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Check Session and Navigate
    checkAuthSession();
  }, []);

  const checkAuthSession = async () => {
    try {
      const activeFlag = await AsyncStorage.getItem('has_active_session');
      const unlockedFlag = await AsyncStorage.getItem('app_unlocked');

      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user || activeFlag === 'true') {
        setHasSession(true);
        setTimeout(() => {
          if (unlockedFlag === 'true') {
            router.replace('/dashboard' as any);
          } else {
            router.replace('/pin' as any);
          }
        }, 500);
      } else {
        setHasSession(false);
        setChecking(false);
      }
    } catch (e) {
      setChecking(false);
    }
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />

      {/* Deep Royal Mesh Gradient */}
      <LinearGradient
        colors={['#020617', '#08122c', '#0a1738', '#020617']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Ambient Glowing Orbs */}
      <View style={s.glowOrbTop} />
      <View style={s.glowOrbBottom} />

      <SafeAreaView style={s.safeArea}>
        <View style={s.centerBox}>
          {/* LOGO ICON WITH GLOW */}
          <Animated.View style={[s.logoContainer, { transform: [{ scale: logoScale }, { scale: pulseAnim }], opacity: logoOpacity }]}>
            <View style={s.logoGlowRing}>
              <View style={s.logoCard}>
                <Image
                  source={require('../assets/images/logo.png')}
                  style={s.logoImg}
                  resizeMode="contain"
                />
              </View>
            </View>
          </Animated.View>

          {/* BRAND TITLE & TAGLINE */}
          <Animated.View style={[s.textBox, { opacity: contentFade }]}>
            <Text style={s.brandTitle}>ABU MAFHAL SUB</Text>
            
            <View style={s.badgePill}>
              <Ionicons name="sparkles" size={10} color="#f5a623" />
              <Text style={s.badgePillText}>Fast • Cheap • Automated VTU</Text>
            </View>

            <Text style={s.brandSub}>
              Data Bundles, Airtime, Cable TV, Bills Payment & Educational Pins at your fingertips.
            </Text>
          </Animated.View>

          {/* LOADING OR BUTTONS */}
          <Animated.View style={[s.actionArea, { opacity: contentFade }]}>
            {checking ? (
              <View style={s.loadingBox}>
                <ActivityIndicator size="small" color="#f5a623" />
                <Text style={s.loadingText}>Securing session...</Text>
              </View>
            ) : (
              <View style={s.buttonGroup}>
                <TouchableOpacity
                  onPress={() => router.push('/(auth)/login')}
                  style={s.primaryBtn}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#f5a623', '#d97706']}
                    style={s.primaryBtnGrad}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={s.primaryBtnText}>Sign In to Account</Text>
                    <Ionicons name="arrow-forward" size={16} color="#060d21" />
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.push('/(auth)/signup')}
                  style={s.secondaryBtn}
                  activeOpacity={0.75}
                >
                  <Text style={s.secondaryBtnText}>Create New Account</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </View>

        {/* BOTTOM SECURITY FOOTER */}
        <View style={s.footer}>
          <View style={s.footerSecurityRow}>
            <Ionicons name="shield-checkmark" size={12} color="#10b981" />
            <Text style={s.footerSecurityText}>256-Bit Bank Grade SSL Encryption</Text>
          </View>
          <Text style={s.versionText}>v1.2.0 • Abu Mafhal Hub</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  glowOrbTop: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(245, 166, 35, 0.12)',
  },
  glowOrbBottom: {
    position: 'absolute',
    bottom: -100,
    left: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(37, 99, 235, 0.14)',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    marginBottom: 20,
  },
  logoGlowRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(245, 166, 35, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 166, 35, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f5a623',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  logoCard: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#0d1b3e',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    overflow: 'hidden',
  },
  logoImg: {
    width: 60,
    height: 60,
  },
  textBox: {
    alignItems: 'center',
    marginBottom: 30,
  },
  brandTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(245, 166, 35, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  badgePillText: {
    color: '#f5a623',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  brandSub: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  actionArea: {
    width: '100%',
    maxWidth: 320,
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  buttonGroup: {
    gap: 10,
  },
  primaryBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#f5a623',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
  },
  primaryBtnText: {
    color: '#060d21',
    fontWeight: '900',
    fontSize: 13.5,
  },
  secondaryBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  footer: {
    alignItems: 'center',
    gap: 4,
  },
  footerSecurityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerSecurityText: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '600',
  },
  versionText: {
    color: '#475569',
    fontSize: 9,
    fontWeight: '500',
  },
});
