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
  apkDownloadUrl?: string;
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
  apkDownloadUrl,
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
      } catch {}
    }

    try {
      await Linking.openURL(targetUrl);
    } catch {
      Linking.openURL('https://abumafhal.com.ng');
    }
  };

  const handleDownloadApk = async () => {
    if (Platform.OS !== 'web') {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }

    const url = apkDownloadUrl || 'https://abumafhal.com.ng';
    try {
      await Linking.openURL(url);
    } catch {
      Linking.openURL(playStoreUrl || DEFAULT_PLAY_STORE_URL);
    }
  };

  const handleSupport = () => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
    const text = encodeURIComponent(
      `Hello Abu Mafhal Support, I need help updating the app to the latest version (v${latestVersion}).`
    );
    Linking.openURL(`https://wa.me/2348145853539?text=${text}`).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={['#070D1E', '#0A1226', '#0F1A36']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Subtle Background Glow */}
      <View style={styles.ambientGlow} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* App Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.iconFrame}>
            <Image
              source={require('../assets/images/logo-icon.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Status Pill */}
        <View style={styles.badgePill}>
          <View style={styles.pulsingDot} />
          <Text style={styles.badgeText}>
            {isForced ? 'MANDATORY UPDATE' : 'UPDATE AVAILABLE'}
          </Text>
        </View>

        {/* Heading & Subtitle */}
        <Text style={styles.title}>
          {isForced ? 'Update Required' : 'New Version Available'}
        </Text>
        <Text style={styles.subtitle}>
          A new version of Abu Mafhal Sub is now available on Google Play with enhanced performance and security upgrades.
        </Text>

        {/* Version Compare Card */}
        <View style={styles.versionCard}>
          <View style={styles.versionColumn}>
            <Text style={styles.versionLabel}>Installed</Text>
            <Text style={styles.versionOldValue}>v{currentVersion}</Text>
          </View>

          <View style={styles.arrowBox}>
            <Ionicons name="arrow-forward" size={16} color="#D97706" />
          </View>

          <View style={styles.versionColumn}>
            <Text style={styles.versionLabel}>Latest</Text>
            <Text style={styles.versionNewValue}>v{latestVersion}</Text>
          </View>
        </View>

        {/* Highlights List */}
        <View style={styles.featuresCard}>
          <View style={styles.featureRow}>
            <View style={[styles.featureIcon, { backgroundColor: 'rgba(217, 119, 6, 0.15)' }]}>
              <Ionicons name="flash" size={16} color="#F59E0B" />
            </View>
            <View style={styles.featureTextCol}>
              <Text style={styles.featureTitle}>AI Smart Dispatch</Text>
              <Text style={styles.featureDesc}>Sub-second 0.4s transaction processing across all networks.</Text>
            </View>
          </View>

          <View style={styles.featureRow}>
            <View style={[styles.featureIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <Ionicons name="shield-checkmark" size={16} color="#10B981" />
            </View>
            <View style={styles.featureTextCol}>
              <Text style={styles.featureTitle}>Advanced 2FA Security</Text>
              <Text style={styles.featureDesc}>Bank-grade 256-bit encryption with biometric authentication.</Text>
            </View>
          </View>

          <View style={[styles.featureRow, { marginBottom: 0 }]}>
            <View style={[styles.featureIcon, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
              <Ionicons name="hardware-chip" size={16} color="#38BDF8" />
            </View>
            <View style={styles.featureTextCol}>
              <Text style={styles.featureTitle}>System Stability & Fixes</Text>
              <Text style={styles.featureDesc}>Optimized user interface with automatic status sync.</Text>
            </View>
          </View>
        </View>

        {/* Optional Custom Release Note from Admin */}
        {message ? (
          <View style={styles.notesCard}>
            <View style={styles.notesHeader}>
              <Ionicons name="document-text-outline" size={15} color="#D97706" />
              <Text style={styles.notesTitle}>Release Notes</Text>
            </View>
            <Text style={styles.notesBody}>{message}</Text>
          </View>
        ) : null}

        {/* Primary Action Button: Google Play Store */}
        <TouchableOpacity
          style={styles.primaryButton}
          activeOpacity={0.9}
          onPress={handleUpdate}
        >
          <LinearGradient
            colors={['#D97706', '#B45309']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.primaryGradient}
          >
            <Ionicons name="logo-google-playstore" size={20} color="#FFFFFF" style={{ marginRight: 10 }} />
            <Text style={styles.primaryButtonText}>UPDATE ON GOOGLE PLAY</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Optional Secondary Action: Direct APK */}
        {apkDownloadUrl ? (
          <TouchableOpacity
            style={styles.secondaryButton}
            activeOpacity={0.8}
            onPress={handleDownloadApk}
          >
            <Ionicons name="download-outline" size={18} color="#38BDF8" style={{ marginRight: 8 }} />
            <Text style={styles.secondaryButtonText}>Direct APK Download</Text>
          </TouchableOpacity>
        ) : null}

        {/* WhatsApp Support Link */}
        <TouchableOpacity
          style={styles.supportButton}
          activeOpacity={0.75}
          onPress={handleSupport}
        >
          <Ionicons name="logo-whatsapp" size={16} color="#25D366" style={{ marginRight: 6 }} />
          <Text style={styles.supportButtonText}>Need Help? Contact Support</Text>
        </TouchableOpacity>

        {/* Optional Dismiss if update is not forced */}
        {!isForced && onDismiss && (
          <TouchableOpacity style={styles.laterButton} onPress={onDismiss} activeOpacity={0.7}>
            <Text style={styles.laterButtonText}>Remind Me Later</Text>
          </TouchableOpacity>
        )}

        {/* Verified Footer */}
        <View style={styles.footerWrap}>
          <Ionicons name="shield-checkmark" size={12} color="#64748B" style={{ marginRight: 5 }} />
          <Text style={styles.footerText}>
            Abu Mafhal Ltd (RC-8979939) • Official Release
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#070D1E',
  },
  ambientGlow: {
    position: 'absolute',
    top: -60,
    alignSelf: 'center',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(217, 119, 6, 0.12)',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 16,
  },
  iconFrame: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#D97706',
  },
  logoImage: {
    width: 60,
    height: 60,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(217, 119, 6, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.35)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 14,
  },
  pulsingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D97706',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 20,
    maxWidth: 320,
  },
  versionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    width: '100%',
    marginBottom: 18,
  },
  versionColumn: {
    alignItems: 'center',
    flex: 1,
  },
  versionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  versionOldValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#EF4444',
  },
  versionNewValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#10B981',
  },
  arrowBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuresCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  featureTextCol: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 15,
  },
  notesCard: {
    width: '100%',
    backgroundColor: 'rgba(217, 119, 6, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.2)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  notesTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#D97706',
    textTransform: 'uppercase',
  },
  notesBody: {
    fontSize: 12,
    lineHeight: 17,
    color: '#E2E8F0',
  },
  primaryButton: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
    marginBottom: 12,
  },
  primaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  secondaryButtonText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#38BDF8',
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginBottom: 8,
  },
  supportButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  laterButton: {
    paddingVertical: 8,
    marginBottom: 8,
  },
  laterButtonText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  footerWrap: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
});
