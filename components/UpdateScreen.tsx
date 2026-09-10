import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  Image,
  ScrollView,
  Share,
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
  const [showFullNotes, setShowFullNotes] = useState(false);

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
      `Sannu Abu Mafhal Support, ina neman taimako game da sabunta sabon version na manhaja (v${latestVersion}).`
    );
    Linking.openURL(`https://wa.me/2348145853539?text=${text}`).catch(() => {});
  };

  const handleShareUpdate = async () => {
    try {
      await Share.share({
        message: `Sabunta sabuwar manhaja ta Abu Mafhal Sub (v${latestVersion}) mai dauke da sabbin fasahohin AI da saurin 0.4s transaction: ${playStoreUrl || DEFAULT_PLAY_STORE_URL}`,
      });
    } catch {}
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={['#040814', '#0a1226', '#0f1f42']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Decorative Cyber Ambient Glows */}
      <View style={styles.glowTopCenter} />
      <View style={styles.glowRight} />
      <View style={styles.glowBottomLeft} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Futuristic App Icon Ring with AI Sparkle */}
        <View style={styles.logoWrapper}>
          <View style={styles.outerPulseGlow}>
            <View style={styles.logoRing}>
              <Image
                source={require('../assets/images/logo-icon.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
          </View>
          <View style={styles.aiBadgeFloat}>
            <Ionicons name="sparkles" size={11} color="#050b14" />
            <Text style={styles.aiBadgeFloatText}>AI CORE v2</Text>
          </View>
        </View>

        {/* Pulsing Pill Status */}
        <View style={styles.badgePill}>
          <View style={styles.pulsingDot} />
          <Ionicons name="hardware-chip-outline" size={14} color="#f5a623" style={{ marginRight: 6 }} />
          <Text style={styles.badgeText}>SABON UPDATE • NEXT-GEN AI RELEASE</Text>
        </View>

        {/* Headline Titles */}
        <Text style={styles.headlineTitle}>Sabunta Abu Mafhal Sub</Text>
        <Text style={styles.headlineSub}>
          An inganta manhajar da sabbin fasahohin AI masu sarrafa biyan kudi da data cikin ƙiftawar ido (0.4s) tare da tsaron asusu na musamman.
        </Text>

        {/* Version Comparison Card */}
        <View style={styles.versionCard}>
          <View style={styles.versionCol}>
            <Text style={styles.versionColLabel}>Version Ɗinka</Text>
            <View style={styles.versionTagOld}>
              <Ionicons name="alert-circle" size={12} color="#f87171" style={{ marginRight: 4 }} />
              <Text style={styles.versionTagOldText}>v{currentVersion}</Text>
            </View>
          </View>

          <View style={styles.versionArrowCol}>
            <View style={styles.arrowGlowWrap}>
              <Ionicons name="arrow-forward" size={16} color="#070d1e" />
            </View>
            <Text style={styles.upgradeText}>UPGRADE</Text>
          </View>

          <View style={styles.versionCol}>
            <Text style={styles.versionColLabel}>Sabuwar Version</Text>
            <View style={styles.versionTagNew}>
              <Ionicons name="sparkles" size={12} color="#34d399" style={{ marginRight: 4 }} />
              <Text style={styles.versionTagNewText}>v{latestVersion}</Text>
            </View>
          </View>
        </View>

        {/* AI Features Highlight Grid */}
        <View style={styles.aiFeaturesCard}>
          <View style={styles.aiCardHeader}>
            <View style={styles.aiIconBadge}>
              <Ionicons name="bulb-outline" size={14} color="#f5a623" />
            </View>
            <Text style={styles.aiCardTitle}>Sabbin Fasahohin AI a Ciki (AI Features):</Text>
          </View>

          {/* AI Feature 1 */}
          <View style={styles.aiFeatureItem}>
            <View style={[styles.aiItemIconBox, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
              <Ionicons name="git-network-outline" size={18} color="#38bdf8" />
            </View>
            <View style={styles.aiItemTextWrap}>
              <View style={styles.aiItemTitleRow}>
                <Text style={styles.aiItemTitle}>AI Smart Route Optimizer</Text>
                <View style={styles.aiMiniPill}>
                  <Text style={styles.aiMiniPillText}>99.9% UPTIME</Text>
                </View>
              </View>
              <Text style={styles.aiItemDesc}>
                Fasahar AI da ke gano layin da yafi sauri (MTN, Airtel, Glo) don tura data da katin waya nan take ba tare da jinkiri ba.
              </Text>
            </View>
          </View>

          {/* AI Feature 2 */}
          <View style={styles.aiFeatureItem}>
            <View style={[styles.aiItemIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#10b981" />
            </View>
            <View style={styles.aiItemTextWrap}>
              <View style={styles.aiItemTitleRow}>
                <Text style={styles.aiItemTitle}>AI Fraud Shield & 2FA Engine</Text>
                <View style={[styles.aiMiniPill, { backgroundColor: 'rgba(16, 185, 129, 0.18)' }]}>
                  <Text style={[styles.aiMiniPillText, { color: '#34d399' }]}>SECURED</Text>
                </View>
              </View>
              <Text style={styles.aiItemDesc}>
                Kariya mai inganci da ke dakile kowanne irin kutse, tare da sahalewar shiga ta fuska ko yatsa (Biometrics).
              </Text>
            </View>
          </View>

          {/* AI Feature 3 */}
          <View style={styles.aiFeatureItem}>
            <View style={[styles.aiItemIconBox, { backgroundColor: 'rgba(245, 166, 35, 0.15)' }]}>
              <Ionicons name="flash-outline" size={18} color="#f5a623" />
            </View>
            <View style={styles.aiItemTextWrap}>
              <View style={styles.aiItemTitleRow}>
                <Text style={styles.aiItemTitle}>AI Turbo Instant Dispatch</Text>
                <View style={[styles.aiMiniPill, { backgroundColor: 'rgba(245, 166, 35, 0.18)' }]}>
                  <Text style={[styles.aiMiniPillText, { color: '#fbbf24' }]}>0.4s SPEED</Text>
                </View>
              </View>
              <Text style={styles.aiItemDesc}>
                Saurin sarrafa biyan NEPA, katin TV (DSTV/GOTV) da canjin kudi a cikin daƙiƙa 0.4 kacal.
              </Text>
            </View>
          </View>

          {/* AI Feature 4 */}
          <View style={[styles.aiFeatureItem, { marginBottom: 0 }]}>
            <View style={[styles.aiItemIconBox, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
              <Ionicons name="pie-chart-outline" size={18} color="#c084fc" />
            </View>
            <View style={styles.aiItemTextWrap}>
              <View style={styles.aiItemTitleRow}>
                <Text style={styles.aiItemTitle}>AI Smart Wallet Assistant</Text>
                <View style={[styles.aiMiniPill, { backgroundColor: 'rgba(168, 85, 247, 0.18)' }]}>
                  <Text style={[styles.aiMiniPillText, { color: '#c084fc' }]}>ANALYTICS</Text>
                </View>
              </View>
              <Text style={styles.aiItemDesc}>
                Kula da yadda kudaden ka ke fita tare da bada shawarwari kan saukin farashin data mafi dacewa da kai.
              </Text>
            </View>
          </View>
        </View>

        {/* Custom Message / Release Notes from Admin */}
        {message ? (
          <View style={styles.releaseNotesBox}>
            <TouchableOpacity
              style={styles.releaseNotesHeader}
              activeOpacity={0.7}
              onPress={() => setShowFullNotes(!showFullNotes)}
            >
              <View style={styles.releaseNotesHeaderLeft}>
                <Ionicons name="newspaper-outline" size={16} color="#f5a623" />
                <Text style={styles.releaseNotesTitle}>Bayanin Sabuntawa (Release Notes)</Text>
              </View>
              <Ionicons
                name={showFullNotes ? 'chevron-up' : 'chevron-down'}
                size={18}
                color="#94a3b8"
              />
            </TouchableOpacity>

            <Text
              style={styles.releaseNotesBody}
              numberOfLines={showFullNotes ? undefined : 3}
            >
              {message}
            </Text>

            {!showFullNotes && message.length > 120 && (
              <TouchableOpacity
                onPress={() => setShowFullNotes(true)}
                style={styles.expandTextBtn}
              >
                <Text style={styles.expandText}>Karanta Karin Bayani...</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        {/* Primary Action Button: Update on Google Play Store */}
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
            <Ionicons name="logo-google-playstore" size={22} color="#070d1e" style={{ marginRight: 10 }} />
            <View style={styles.primaryBtnTextWrap}>
              <Text style={styles.primaryButtonText}>SABUNTA A GOOGLE PLAY STORE</Text>
              <Text style={styles.primaryButtonSub}>Official Verified Android Build</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Secondary Action: Direct APK Download / Uptodown option */}
        <TouchableOpacity
          style={styles.apkButton}
          activeOpacity={0.85}
          onPress={handleDownloadApk}
        >
          <View style={styles.apkButtonInner}>
            <Ionicons name="download-outline" size={19} color="#38bdf8" style={{ marginRight: 8 }} />
            <Text style={styles.apkButtonText}>
              {apkDownloadUrl ? 'Sauke Direct APK File (Direct Download)' : 'Sauke Ta Wata Hanyar (Direct Link)'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Helper Action Row: Share + WhatsApp Helpdesk */}
        <View style={styles.helpRow}>
          <TouchableOpacity
            style={styles.helpRowBtn}
            activeOpacity={0.8}
            onPress={handleSupport}
          >
            <Ionicons name="logo-whatsapp" size={17} color="#25D366" style={{ marginRight: 6 }} />
            <Text style={styles.helpRowBtnText}>WhatsApp Support</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.helpRowBtn}
            activeOpacity={0.8}
            onPress={handleShareUpdate}
          >
            <Ionicons name="share-social-outline" size={17} color="#f5a623" style={{ marginRight: 6 }} />
            <Text style={styles.helpRowBtnText}>Share Link</Text>
          </TouchableOpacity>
        </View>

        {/* Optional dismiss button if update is not mandatory */}
        {!isForced && onDismiss && (
          <TouchableOpacity style={styles.laterButton} onPress={onDismiss} activeOpacity={0.7}>
            <Text style={styles.laterButtonText}>Daga Baya (Remind Me Later)</Text>
          </TouchableOpacity>
        )}

        {/* Corporate Verified Footnote */}
        <View style={styles.footerWrap}>
          <Ionicons name="shield-checkmark" size={12} color="#64748b" style={{ marginRight: 5 }} />
          <Text style={styles.footerCopy}>
            Abu Mafhal Ltd (RC-8979939) • Certified Google Play Protection
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#040814',
  },
  glowTopCenter: {
    position: 'absolute',
    top: -80,
    alignSelf: 'center',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(245, 166, 35, 0.16)',
  },
  glowRight: {
    position: 'absolute',
    top: '30%',
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
  },
  glowBottomLeft: {
    position: 'absolute',
    bottom: -50,
    left: -60,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(16, 185, 129, 0.07)',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  logoWrapper: {
    marginBottom: 16,
    alignItems: 'center',
    position: 'relative',
  },
  outerPulseGlow: {
    padding: 4,
    borderRadius: 34,
    backgroundColor: 'rgba(245, 166, 35, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.3)',
  },
  logoRing: {
    width: 90,
    height: 90,
    borderRadius: 28,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f5a623',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
    borderWidth: 3,
    borderColor: '#f5a623',
  },
  logoImage: {
    width: 62,
    height: 62,
  },
  aiBadgeFloat: {
    position: 'absolute',
    bottom: -8,
    backgroundColor: '#f5a623',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
    shadowColor: '#f5a623',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  aiBadgeFloatText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#070d1e',
    letterSpacing: 0.5,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 166, 35, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.4)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 10,
    marginBottom: 12,
  },
  pulsingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#34d399',
    marginRight: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#f5a623',
    letterSpacing: 0.7,
  },
  headlineTitle: {
    fontSize: 23,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  headlineSub: {
    fontSize: 12.5,
    lineHeight: 19,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 18,
    maxWidth: 340,
  },
  versionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    width: '100%',
    marginBottom: 16,
  },
  versionCol: {
    alignItems: 'center',
    flex: 1,
  },
  versionColLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  versionTagOld: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  versionTagOldText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#f87171',
  },
  versionArrowCol: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  arrowGlowWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f5a623',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  upgradeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#f5a623',
    letterSpacing: 0.8,
  },
  versionTagNew: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.45)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
  },
  versionTagNewText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#34d399',
  },
  aiFeaturesCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  aiCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    paddingBottom: 10,
  },
  aiIconBadge: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: 'rgba(245, 166, 35, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiCardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#f5a623',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  aiFeatureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 13,
  },
  aiItemIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
    marginTop: 1,
  },
  aiItemTextWrap: {
    flex: 1,
  },
  aiItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  aiItemTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  aiMiniPill: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  aiMiniPillText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#38bdf8',
  },
  aiItemDesc: {
    fontSize: 10.5,
    color: '#94a3b8',
    lineHeight: 14.5,
  },
  releaseNotesBox: {
    width: '100%',
    backgroundColor: 'rgba(245, 166, 35, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.22)',
    borderRadius: 14,
    padding: 13,
    marginBottom: 16,
  },
  releaseNotesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  releaseNotesHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  releaseNotesTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#f5a623',
    textTransform: 'uppercase',
  },
  releaseNotesBody: {
    fontSize: 12,
    lineHeight: 17,
    color: '#e2e8f0',
  },
  expandTextBtn: {
    marginTop: 5,
    alignSelf: 'flex-start',
  },
  expandText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#f5a623',
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
    marginBottom: 10,
  },
  primaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  primaryBtnTextWrap: {
    alignItems: 'flex-start',
  },
  primaryButtonText: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#070d1e',
    letterSpacing: 0.4,
  },
  primaryButtonSub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
  },
  apkButton: {
    width: '100%',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  apkButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  apkButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#38bdf8',
  },
  helpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 10,
    marginBottom: 14,
  },
  helpRowBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 10,
    borderRadius: 12,
  },
  helpRowBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#cbd5e1',
  },
  laterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  laterButtonText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  footerWrap: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerCopy: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748b',
    textAlign: 'center',
  },
});
