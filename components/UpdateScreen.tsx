import React, { useState, useEffect } from 'react';
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
import Svg, { Path } from 'react-native-svg';
import { supabase } from '../services/supabase';

interface UpdateScreenProps {
  currentVersion?: string;
  latestVersion?: string;
  playStoreUrl?: string;
  appStoreUrl?: string;
  apkDownloadUrl?: string;
  message?: string;
  isForced?: boolean;
  logoUrl?: string | any;
  onDismiss?: () => void;
}

const DEFAULT_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.muhammmadsaniishaq.abumafhalsub';
const DEFAULT_APP_STORE_URL =
  'https://apps.apple.com/app/abu-mafhal-sub';
const ANDROID_PACKAGE_NAME = 'com.muhammmadsaniishaq.abumafhalsub';

function extractLogoUri(val: any): string | null {
  if (!val) return null;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        return parsed.url || parsed.uri || parsed.src || null;
      } catch {}
    }
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
      return trimmed;
    }
  }
  if (typeof val === 'object' && val !== null) {
    return val.url || val.uri || val.src || null;
  }
  return null;
}

function isDistortedLegacyLogo(uri: string | null): boolean {
  if (!uri) return false;
  // If url points to legacy black badge icon or corrupted checkerboard jpeg
  return uri.includes('icon_1784121258904') || uri.includes('logo_1788567402265');
}

/**
 * Authentic 4-Color Google Play Store Logo (Cyan, Yellow, Red, Green)
 */
function GooglePlayBrandLogo({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512">
      {/* Left Blue/Cyan */}
      <Path
        fill="#00D4FF"
        d="M29.5 25.1c-4.3 4.7-6.8 12.1-6.8 21.6v418.6c0 9.5 2.5 16.9 6.8 21.6l1.2 1.1 234.3-234.3v-5.4L30.7 24l-1.2 1.1z"
      />
      {/* Right Yellow */}
      <Path
        fill="#FFCE00"
        d="M342.3 337.8l-77.3-77.3v-5.4l77.3-77.3 1.8 1 91.6 52c26.1 14.8 26.1 39.1 0 53.9l-91.6 52-1.8 1.1z"
      />
      {/* Bottom Red */}
      <Path
        fill="#FF3A44"
        d="M265 255.1L29.5 490.6c8.6 9.1 22.9 10.2 39.1 1l273.7-155.5-77.3-81z"
      />
      {/* Top Green */}
      <Path
        fill="#00F076"
        d="M265 256.9l77.3-77.3L68.6 23.9c-16.2-9.2-30.5-8.1-39.1 1.1l235.5 231.9z"
      />
    </Svg>
  );
}

export default function UpdateScreen({
  currentVersion = '1.0.4',
  latestVersion = '1.0.5',
  playStoreUrl = DEFAULT_PLAY_STORE_URL,
  appStoreUrl = DEFAULT_APP_STORE_URL,
  apkDownloadUrl,
  message,
  isForced = true,
  logoUrl: initialLogoUrl,
  onDismiss,
}: UpdateScreenProps) {
  const isIOS = Platform.OS === 'ios';
  const isAndroid = Platform.OS === 'android';

  const [dynamicLogo, setDynamicLogo] = useState<string | null>(() => {
    const parsed = extractLogoUri(initialLogoUrl);
    return isDistortedLegacyLogo(parsed) ? null : parsed;
  });
  const [imageFailed, setImageFailed] = useState(false);

  // Fetch admin-uploaded logo from app_settings if not already available
  useEffect(() => {
    if (initialLogoUrl) {
      const parsed = extractLogoUri(initialLogoUrl);
      if (parsed && !isDistortedLegacyLogo(parsed)) {
        setDynamicLogo(parsed);
        return;
      }
    }

    let isMounted = true;
    const fetchAdminLogo = async () => {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('key, value')
          .in('key', ['app_logo', 'app_logo_icon']);

        if (data && isMounted) {
          const logoSetting = data.find((s) => s.key === 'app_logo');
          const iconSetting = data.find((s) => s.key === 'app_logo_icon');
          const target = logoSetting?.value || iconSetting?.value;
          const uri = extractLogoUri(target);
          if (uri && !isDistortedLegacyLogo(uri)) {
            setDynamicLogo(uri);
          }
        }
      } catch {}
    };

    fetchAdminLogo();
    return () => {
      isMounted = false;
    };
  }, [initialLogoUrl]);

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
      {/* Light, Soft, Warm Background (No Dark Colors) */}
      <LinearGradient
        colors={['#F8FAFC', '#F1F5F9', '#E8EEF5']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Subtle Warm Amber Light Halo */}
      <View style={styles.lightHalo} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Compact, Ultra-Modern Card */}
        <View style={styles.card}>
          {/* Admin Uploaded Logo / Official Brand Logo */}
          <View style={styles.logoRing}>
            {dynamicLogo && !imageFailed ? (
              <Image
                source={{ uri: dynamicLogo }}
                style={styles.logoImage}
                resizeMode="contain"
                onError={() => setImageFailed(true)}
              />
            ) : (
              <Image
                source={require('../assets/images/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            )}
          </View>

          {/* Status Badge */}
          <View style={styles.statusBadge}>
            <View style={styles.greenDot} />
            <Text style={styles.statusBadgeText}>
              {isForced ? 'MANDATORY UPDATE' : 'NEW VERSION AVAILABLE'}
            </Text>
          </View>

          {/* Clean Modern Typography */}
          <Text style={styles.title}>
            {isForced ? 'Update Required' : 'New Version Ready'}
          </Text>
          <Text style={styles.subtitle}>
            {isIOS
              ? 'A new build with enhanced speed and security is now live on the Apple App Store.'
              : 'A new build with enhanced speed and security is now live on Google Play.'}
          </Text>

          {/* Version Diff Bar */}
          <View style={styles.versionBar}>
            <View style={styles.versionCol}>
              <Text style={styles.versionLabel}>Installed</Text>
              <View style={styles.oldTag}>
                <Text style={styles.oldTagText}>v{currentVersion}</Text>
              </View>
            </View>

            <View style={styles.arrowCol}>
              <Ionicons name="arrow-forward" size={14} color="#D97706" />
            </View>

            <View style={styles.versionCol}>
              <Text style={styles.versionLabel}>Latest</Text>
              <View style={styles.newTag}>
                <Text style={styles.newTagText}>v{latestVersion}</Text>
              </View>
            </View>
          </View>

          {/* 3 Compact Feature Highlights */}
          <View style={styles.featureRow}>
            <View style={[styles.featureChip, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
              <Ionicons name="flash" size={11} color="#D97706" />
              <Text style={[styles.featureChipText, { color: '#B45309' }]}>0.4s Speed</Text>
            </View>
            <View style={[styles.featureChip, { backgroundColor: '#DCFCE7', borderColor: '#BBF7D0' }]}>
              <Ionicons name="shield-checkmark" size={11} color="#16A34A" />
              <Text style={[styles.featureChipText, { color: '#15803D' }]}>2FA Security</Text>
            </View>
            <View style={[styles.featureChip, { backgroundColor: '#E0F2FE', borderColor: '#BAE6FD' }]}>
              <Ionicons name="git-network" size={11} color="#0284C7" />
              <Text style={[styles.featureChipText, { color: '#0369A1' }]}>AI Routing</Text>
            </View>
          </View>

          {/* Optional Admin Release Message */}
          {message ? (
            <View style={styles.messageBox}>
              <Ionicons name="information-circle" size={15} color="#D97706" style={{ marginTop: 1 }} />
              <Text style={styles.messageText} numberOfLines={3}>
                {message}
              </Text>
            </View>
          ) : null}

          {/* Primary Button: Luxury Navy Gradient with Authentic Google Play 4-Color Brand Logo */}
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.88}
            onPress={handleUpdate}
          >
            {isIOS ? (
              <LinearGradient
                colors={['#0B1E40', '#1E3A8A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryGradient}
              >
                <View style={styles.playIconBadge}>
                  <Ionicons name="logo-apple" size={20} color="#0F172A" />
                </View>
                <View>
                  <Text style={styles.primaryBtnTitle}>UPDATE ON APP STORE</Text>
                  <Text style={styles.primaryBtnSub}>Official Apple App Store Release</Text>
                </View>
              </LinearGradient>
            ) : (
              <LinearGradient
                colors={['#0B1E40', '#1E3A8A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryGradient}
              >
                <View style={styles.playIconBadge}>
                  <GooglePlayBrandLogo size={22} />
                </View>
                <View>
                  <Text style={styles.primaryBtnTitle}>UPDATE ON GOOGLE PLAY</Text>
                  <Text style={styles.primaryBtnSub}>Official Google Play Verified Release</Text>
                </View>
              </LinearGradient>
            )}
          </TouchableOpacity>

          {/* Direct APK Link (Android / Web only) */}
          {!isIOS && apkDownloadUrl ? (
            <TouchableOpacity
              style={styles.apkLink}
              activeOpacity={0.8}
              onPress={handleDownloadApk}
            >
              <Ionicons name="download-outline" size={14} color="#0284C7" style={{ marginRight: 6 }} />
              <Text style={styles.apkLinkText}>Direct APK Download (.apk)</Text>
            </TouchableOpacity>
          ) : null}

          {/* Secondary Actions: Support & Later */}
          <View style={styles.actionLinksRow}>
            <TouchableOpacity
              style={styles.supportLink}
              activeOpacity={0.7}
              onPress={handleSupport}
            >
              <Ionicons name="logo-whatsapp" size={14} color="#16A34A" style={{ marginRight: 4 }} />
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
        <View style={styles.footer}>
          <Ionicons name="shield-checkmark" size={11} color="#94A3B8" style={{ marginRight: 4 }} />
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
    backgroundColor: '#F8FAFC',
  },
  lightHalo: {
    position: 'absolute',
    top: '12%',
    alignSelf: 'center',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(217, 119, 6, 0.06)',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  card: {
    width: '100%',
    maxWidth: 375,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 22,
    paddingVertical: 22,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
  },
  logoRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  logoImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    marginBottom: 10,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  statusBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#047857',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 19,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 17,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 14,
    paddingHorizontal: 6,
  },
  versionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
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
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  oldTag: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  oldTagText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#DC2626',
  },
  newTag: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  newTagText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#16A34A',
  },
  arrowCol: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
    marginBottom: 12,
  },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  featureChipText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  messageBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 9,
    gap: 6,
    width: '100%',
    marginBottom: 12,
  },
  messageText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
    color: '#92400E',
    fontWeight: '500',
  },
  primaryButton: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#0B1E40',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 10,
  },
  primaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  playIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  primaryBtnTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  primaryBtnSub: {
    fontSize: 9.5,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.85)',
  },
  apkLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    marginBottom: 6,
  },
  apkLinkText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0284C7',
  },
  actionLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 4,
  },
  supportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  supportLinkText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#16A34A',
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
  footer: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#94A3B8',
  },
});
