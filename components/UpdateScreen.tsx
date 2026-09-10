import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  Image,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

interface UpdateScreenProps {
  currentVersion?: string;
  latestVersion?: string;
  playStoreUrl?: string;
  message?: string;
  isForced?: boolean;
  onDismiss?: () => void;
}

const DEFAULT_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.muhammmadsaniishaq.abumafhalsub';
const ANDROID_PACKAGE_NAME = 'com.muhammmadsaniishaq.abumafhalsub';

export default function UpdateScreen({
  currentVersion = '1.0.4',
  latestVersion = '1.0.5',
  playStoreUrl = DEFAULT_PLAY_STORE_URL,
  message,
  isForced = true,
  onDismiss,
}: UpdateScreenProps) {
  const handleUpdate = async () => {
    if (Platform.OS !== 'web') {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } catch {}
    }

    const targetUrl = playStoreUrl || DEFAULT_PLAY_STORE_URL;

    if (Platform.OS === 'android') {
      const marketUrl = `market://details?id=${ANDROID_PACKAGE_NAME}`;
      try {
        const canOpen = await Linking.canOpenURL(marketUrl);
        if (canOpen) {
          await Linking.openURL(marketUrl);
          return;
        }
      } catch {
        // Fallback to web URL below
      }
    }

    try {
      await Linking.openURL(targetUrl);
    } catch {
      Linking.openURL('https://abumafhal.com.ng');
    }
  };

  const handleSupport = () => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
    const text = encodeURIComponent(
      `Sannu Abu Mafhal Support, ina neman taimako game da sabunta sabon version na Abu Mafhal Sub (v${latestVersion}).`
    );
    Linking.openURL(`https://wa.me/2348145853539?text=${text}`).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={['#070d1e', '#0d1b3e', '#122454']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Decorative Glow Circles */}
      <View style={styles.glowTopRight} />
      <View style={styles.glowBottomLeft} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Top App Icon with Glowing Ring */}
        <View style={styles.logoWrapper}>
          <View style={styles.logoRing}>
            <Image
              source={require('../assets/images/logo-icon.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Pulsing Status Badge */}
        <View style={styles.badgePill}>
          <Ionicons name="sparkles" size={13} color="#f5a623" style={{ marginRight: 5 }} />
          <Text style={styles.badgeText}>SABON UPDATE • NEW VERSION AVAILABLE</Text>
        </View>

        {/* Main Headline */}
        <Text style={styles.headlineTitle}>Sabunta Abu Mafhal Sub</Text>
        <Text style={styles.headlineSub}>
          Akwai sabuwar manhaja a Google Play Store. Da fatan za a sabunta don ci gaba da amfani da sabbin
          fasahohi da tsaro.
        </Text>

        {/* Version Comparison Card */}
        <View style={styles.versionCard}>
          <View style={styles.versionCol}>
            <Text style={styles.versionColLabel}>Version Ɗinka</Text>
            <View style={styles.versionTagOld}>
              <Text style={styles.versionTagOldText}>v{currentVersion}</Text>
            </View>
          </View>

          <View style={styles.versionArrowCol}>
            <Ionicons name="arrow-forward-circle" size={28} color="#f5a623" />
          </View>

          <View style={styles.versionCol}>
            <Text style={styles.versionColLabel}>Sabuwar Version</Text>
            <View style={styles.versionTagNew}>
              <Text style={styles.versionTagNewText}>v{latestVersion}</Text>
            </View>
          </View>
        </View>

        {/* Custom Message from Admin (if available) */}
        {message ? (
          <View style={styles.customMessageBox}>
            <View style={styles.customMessageHeader}>
              <Ionicons name="information-circle" size={18} color="#f5a623" />
              <Text style={styles.customMessageTitle}>Bayanin Sabuntawa (Release Note)</Text>
            </View>
            <Text style={styles.customMessageText}>{message}</Text>
          </View>
        ) : null}

        {/* Benefits List */}
        <View style={styles.benefitsCard}>
          <Text style={styles.benefitsHeader}>Abubuwan Da Aka Inganta:</Text>

          <View style={styles.benefitRow}>
            <View style={[styles.benefitIconBox, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
              <Ionicons name="flash" size={16} color="#38bdf8" />
            </View>
            <View style={styles.benefitTextCol}>
              <Text style={styles.benefitTitle}>Saurin Biyan Kudi da Isar da Data</Text>
              <Text style={styles.benefitDesc}>0.4s instant automated telecom and utility dispatch.</Text>
            </View>
          </View>

          <View style={styles.benefitRow}>
            <View style={[styles.benefitIconBox, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
              <Ionicons name="shield-checkmark" size={16} color="#22c55e" />
            </View>
            <View style={styles.benefitTextCol}>
              <Text style={styles.benefitTitle}>Ingantaccen Tsaron Asusu da 2FA</Text>
              <Text style={styles.benefitDesc}>NDPA & 256-bit bank-grade encryption security.</Text>
            </View>
          </View>

          <View style={styles.benefitRow}>
            <View style={[styles.benefitIconBox, { backgroundColor: 'rgba(245, 166, 35, 0.15)' }]}>
              <Ionicons name="checkmark-done-circle" size={16} color="#f5a623" />
            </View>
            <View style={styles.benefitTextCol}>
              <Text style={styles.benefitTitle}>Gyaran Kurakurai da Karin Sahalci</Text>
              <Text style={styles.benefitDesc}>Smoother UI experience with auto transaction updates.</Text>
            </View>
          </View>
        </View>

        {/* Primary CTA: Update on Play Store */}
        <TouchableOpacity
          style={styles.primaryButton}
          activeOpacity={0.88}
          onPress={handleUpdate}
        >
          <LinearGradient
            colors={['#f5a623', '#d97706']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.primaryButtonGradient}
          >
            <Ionicons name="logo-google-playstore" size={22} color="#0d1b3e" style={{ marginRight: 10 }} />
            <Text style={styles.primaryButtonText}>SABUNTA A PLAY STORE</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Secondary: WhatsApp Support */}
        <TouchableOpacity
          style={styles.supportButton}
          activeOpacity={0.8}
          onPress={handleSupport}
        >
          <Ionicons name="logo-whatsapp" size={18} color="#25D366" style={{ marginRight: 8 }} />
          <Text style={styles.supportButtonText}>Kana Bukatar Taimako? Yi Magana a WhatsApp</Text>
        </TouchableOpacity>

        {/* Optional dismiss if not forced */}
        {!isForced && onDismiss && (
          <TouchableOpacity style={styles.laterButton} onPress={onDismiss} activeOpacity={0.7}>
            <Text style={styles.laterButtonText}>Daga Baya (Remind Me Later)</Text>
          </TouchableOpacity>
        )}

        {/* Corporate Footer */}
        <View style={styles.footerWrap}>
          <Text style={styles.footerCopy}>
            Abu Mafhal Ltd (RC-8979939) • Google Play Store Verified
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#070d1e',
  },
  glowTopRight: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(245, 166, 35, 0.12)',
  },
  glowBottomLeft: {
    position: 'absolute',
    bottom: -60,
    left: -60,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  logoWrapper: {
    marginBottom: 16,
    alignItems: 'center',
  },
  logoRing: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f5a623',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 3,
    borderColor: '#f5a623',
  },
  logoImage: {
    width: 68,
    height: 68,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 166, 35, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.4)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 14,
  },
  badgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#f5a623',
    letterSpacing: 0.6,
  },
  headlineTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  headlineSub: {
    fontSize: 13,
    lineHeight: 20,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 20,
    maxWidth: 340,
  },
  versionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 20,
    width: '100%',
    marginBottom: 18,
  },
  versionCol: {
    alignItems: 'center',
    flex: 1,
  },
  versionColLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 6,
  },
  versionTagOld: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  versionTagOldText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#f87171',
  },
  versionArrowCol: {
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  versionTagNew: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
  },
  versionTagNewText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4ade80',
  },
  customMessageBox: {
    width: '100%',
    backgroundColor: 'rgba(245, 166, 35, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.25)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
  },
  customMessageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  customMessageTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#f5a623',
    textTransform: 'uppercase',
  },
  customMessageText: {
    fontSize: 12.5,
    lineHeight: 18,
    color: '#e2e8f0',
  },
  benefitsCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 24,
  },
  benefitsHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#e2e8f0',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  benefitIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  benefitTextCol: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 2,
  },
  benefitDesc: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 15,
  },
  primaryButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#f5a623',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 8,
    marginBottom: 12,
  },
  primaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0d1b3e',
    letterSpacing: 0.5,
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(37, 211, 102, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(37, 211, 102, 0.25)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    width: '100%',
    marginBottom: 16,
  },
  supportButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#25D366',
  },
  laterButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  laterButtonText: {
    fontSize: 12.5,
    color: '#94a3b8',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  footerWrap: {
    marginTop: 8,
    alignItems: 'center',
  },
  footerCopy: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    textAlign: 'center',
  },
});
