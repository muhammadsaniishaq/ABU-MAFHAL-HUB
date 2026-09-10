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
  appStoreUrl?: string;
  apkDownloadUrl?: string;
  message?: string;
  isForced?: boolean;
  onDismiss?: () => void;
}

const DEFAULT_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.muhammmadsaniishaq.abumafhalsub';
const DEFAULT_APP_STORE_URL =
  'https://apps.apple.com/app/abu-mafhal-sub';
const ANDROID_PACKAGE_NAME = 'com.muhammmadsaniishaq.abumafhalsub';

export default function UpdateScreen({
  currentVersion = '1.0.4',
  latestVersion = '1.0.5',
  playStoreUrl = DEFAULT_PLAY_STORE_URL,
  appStoreUrl = DEFAULT_APP_STORE_URL,
  apkDownloadUrl,
  message,
  isForced = true,
  onDismiss,
}: UpdateScreenProps) {
  const isIOS = Platform.OS === 'ios';
  const isAndroid = Platform.OS === 'android';

  const handleUpdate = async () => {
    if (Platform.OS !== 'web') {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } catch {}
    }

    // 1. iOS App Store
    if (isIOS) {
      const targetUrl = appStoreUrl || DEFAULT_APP_STORE_URL;
      try {
        await Linking.openURL(targetUrl);
        return;
      } catch {
        Linking.openURL('https://abumafhal.com.ng');
        return;
      }
    }

    // 2. Android Google Play Store
    if (isAndroid) {
      const marketUrl = `market://details?id=${ANDROID_PACKAGE_NAME}`;
      try {
        const canOpen = await Linking.canOpenURL(marketUrl);
        if (canOpen) {
          await Linking.openURL(marketUrl);
          return;
        }
      } catch {}
    }

    // 3. Fallback / Web
    const fallbackUrl = isIOS
      ? (appStoreUrl || DEFAULT_APP_STORE_URL)
      : (playStoreUrl || DEFAULT_PLAY_STORE_URL);

    try {
      await Linking.openURL(fallbackUrl);
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
      `Hello Abu Mafhal Support, I need assistance updating the app to v${latestVersion}.`
    );
    Linking.openURL(`https://wa.me/2348145853539?text=${text}`).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={['#060B18', '#0A1224', '#0D1832']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Subtle Ambient Radial Glow */}
      <View style={styles.ambientGlow} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Compact Card Container */}
        <View style={styles.cardContainer}>
          {/* App Icon */}
          <View style={styles.iconFrame}>
            <Image
              source={require('../assets/images/logo-icon.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          {/* Status Pill */}
          <View style={styles.badgePill}>
            <View style={styles.pulsingDot} />
            <Text style={styles.badgeText}>
              {isForced ? 'MANDATORY UPDATE' : 'NEW VERSION AVAILABLE'}
            </Text>
          </View>

          {/* Headline & Subtitle */}
          <Text style={styles.title}>
            {isForced ? 'Update Required' : 'New Version Available'}
          </Text>
          <Text style={styles.subtitle}>
            {isIOS
              ? 'A new version with performance & security updates is available on the App Store.'
              : 'A new version with performance & security updates is available on Google Play.'}
          </Text>

          {/* Compact Version Diff */}
          <View style={styles.versionBar}>
            <View style={styles.versionCol}>
              <Text style={styles.versionLabel}>Current</Text>
              <Text style={styles.versionOldVal}>v{currentVersion}</Text>
            </View>

            <View style={styles.versionArrow}>
              <Ionicons name="arrow-forward" size={14} color="#D97706" />
            </View>

            <View style={styles.versionCol}>
              <Text style={styles.versionLabel}>Latest</Text>
              <Text style={styles.versionNewVal}>v{latestVersion}</Text>
            </View>
          </View>

          {/* 3 Compact Feature Pills */}
          <View style={styles.featurePillsRow}>
            <View style={styles.featurePill}>
              <Ionicons name="flash" size={11} color="#F59E0B" />
              <Text style={styles.featurePillText}>0.4s Turbo Speed</Text>
            </View>
            <View style={styles.featurePill}>
              <Ionicons name="shield-checkmark" size={11} color="#10B981" />
              <Text style={styles.featurePillText}>2FA Security</Text>
            </View>
            <View style={styles.featurePill}>
              <Ionicons name="git-network" size={11} color="#38BDF8" />
              <Text style={styles.featurePillText}>AI Smart Route</Text>
            </View>
          </View>

          {/* Optional Message from Admin */}
          {message ? (
            <View style={styles.messageBox}>
              <Ionicons name="information-circle-outline" size={14} color="#D97706" style={{ marginTop: 1 }} />
              <Text style={styles.messageText} numberOfLines={3}>
                {message}
              </Text>
            </View>
          ) : null}

          {/* Primary Platform Button: App Store for iOS vs Google Play for Android */}
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.88}
            onPress={handleUpdate}
          >
            <LinearGradient
              colors={['#D97706', '#B45309']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryGradient}
            >
              {isIOS ? (
                <Ionicons name="logo-apple" size={19} color="#FFFFFF" style={{ marginRight: 8 }} />
              ) : (
                <Ionicons name="logo-google-playstore" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              )}
              <Text style={styles.primaryButtonText}>
                {isIOS ? 'UPDATE ON APP STORE' : 'UPDATE ON GOOGLE PLAY'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Direct APK Download for Android/Web if provided */}
          {!isIOS && apkDownloadUrl ? (
            <TouchableOpacity
              style={styles.apkButton}
              activeOpacity={0.8}
              onPress={handleDownloadApk}
            >
              <Ionicons name="download-outline" size={15} color="#38BDF8" style={{ marginRight: 6 }} />
              <Text style={styles.apkButtonText}>Direct APK Download (.apk)</Text>
            </TouchableOpacity>
          ) : null}

          {/* Bottom Action Row: WhatsApp Support & Later */}
          <View style={styles.bottomLinksRow}>
            <TouchableOpacity
              style={styles.supportLink}
              activeOpacity={0.7}
              onPress={handleSupport}
            >
              <Ionicons name="logo-whatsapp" size={14} color="#25D366" style={{ marginRight: 4 }} />
              <Text style={styles.supportLinkText}>WhatsApp Support</Text>
            </TouchableOpacity>

            {!isForced && onDismiss && (
              <TouchableOpacity
                style={styles.laterLink}
                activeOpacity={0.7}
                onPress={onDismiss}
              >
                <Text style={styles.laterLinkText}>Remind Later</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Discreet Footer */}
        <View style={styles.footerWrap}>
          <Ionicons name="shield-checkmark" size={11} color="#64748B" style={{ marginRight: 4 }} />
          <Text style={styles.footerText}>
            Abu Mafhal Ltd (RC-8979939) • Verified Release
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#060B18',
  },
  ambientGlow: {
    position: 'absolute',
    top: '15%',
    alignSelf: 'center',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(217, 119, 6, 0.08)',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  iconFrame: {
    width: 68,
    height: 68,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#D97706',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  logoImage: {
    width: 48,
    height: 48,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(217, 119, 6, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 16,
    marginBottom: 10,
  },
  pulsingDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#D97706',
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 19,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 17,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 14,
    paddingHorizontal: 8,
  },
  versionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    width: '100%',
    marginBottom: 12,
  },
  versionCol: {
    alignItems: 'center',
    flex: 1,
  },
  versionLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  versionOldVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#EF4444',
  },
  versionNewVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#10B981',
  },
  versionArrow: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featurePillsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
    marginBottom: 12,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  featurePillText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  messageBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(217, 119, 6, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.18)',
    borderRadius: 10,
    padding: 8,
    gap: 6,
    width: '100%',
    marginBottom: 12,
  },
  messageText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
    color: '#CBD5E1',
  },
  primaryButton: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 10,
  },
  primaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  apkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.22)',
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  apkButtonText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#38BDF8',
  },
  bottomLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 2,
  },
  supportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  supportLinkText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#94A3B8',
  },
  laterLink: {
    paddingVertical: 4,
  },
  laterLinkText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
    textDecorationLine: 'underline',
  },
  footerWrap: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748B',
  },
});
