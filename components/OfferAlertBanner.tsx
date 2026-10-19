import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Linking,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppSettings } from '../hooks/useAppSettings';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface OfferAlertData {
  is_active?: boolean;
  badge?: string;
  title?: string;
  description?: string;
  target_page?: string;
  custom_url?: string;
  button_text?: string;
  theme?: 'amber' | 'emerald' | 'navy' | 'crimson' | 'indigo';
  dismissable?: boolean;
  updated_at?: number;
}

export default function OfferAlertBanner() {
  const { settings } = useAppSettings();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && windowWidth >= 768;

  const [dismissed, setDismissed] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const rawOffer = settings?.offer_alert;
  let offer: OfferAlertData | null = null;

  if (rawOffer) {
    if (typeof rawOffer === 'string') {
      try {
        offer = JSON.parse(rawOffer);
      } catch (_) {}
    } else if (typeof rawOffer === 'object') {
      offer = rawOffer;
    }
  }

  // Check if dismissed previously for this specific offer version
  useEffect(() => {
    if (offer?.updated_at) {
      AsyncStorage.getItem(`@offer_alert_dismissed_${offer.updated_at}`).then((val) => {
        if (val === 'true') setDismissed(true);
      }).catch(() => {});
    }
  }, [offer?.updated_at]);

  // Pulse animation for badge / icon
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.12,
          duration: 900,
          useNativeDriver: Platform.OS !== 'web',
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: Platform.OS !== 'web',
          easing: Easing.inOut(Easing.ease),
        }),
      ])
    ).start();
  }, [pulseAnim]);

  if (!offer || !offer.is_active || dismissed) {
    return null;
  }

  const handleDismiss = async () => {
    setDismissed(true);
    if (offer?.updated_at) {
      try {
        await AsyncStorage.setItem(`@offer_alert_dismissed_${offer.updated_at}`, 'true');
      } catch (_) {}
    }
  };

  const handlePress = async () => {
    const customUrl = offer?.custom_url?.trim();
    if (customUrl) {
      if (customUrl.startsWith('http://') || customUrl.startsWith('https://') || customUrl.startsWith('whatsapp:')) {
        Linking.openURL(customUrl).catch(() => {});
        return;
      }
      try {
        router.push(customUrl as any);
        return;
      } catch (_) {}
    }

    const targetPage = offer?.target_page || '/data';
    try {
      router.push(targetPage as any);
    } catch (_) {
      router.push('/(app)/data');
    }
  };

  // Color theme definitions
  const theme = offer.theme || 'amber';
  const themeConfigs = {
    amber: {
      gradient: ['#78350F', '#B45309', '#D97706'],
      borderColor: '#F59E0B',
      badgeBg: '#F59E0B',
      badgeText: '#000000',
      btnGradient: ['#F59E0B', '#D97706'],
      btnText: '#0F172A',
      icon: 'flame',
      iconColor: '#FDE68A',
    },
    emerald: {
      gradient: ['#064E3B', '#047857', '#059669'],
      borderColor: '#10B981',
      badgeBg: '#10B981',
      badgeText: '#FFFFFF',
      btnGradient: ['#10B981', '#047857'],
      btnText: '#FFFFFF',
      icon: 'pricetag',
      iconColor: '#A7F3D0',
    },
    navy: {
      gradient: ['#0F172A', '#1E293B', '#0F172A'],
      borderColor: '#F5A623',
      badgeBg: '#F5A623',
      badgeText: '#0F172A',
      btnGradient: ['#F5A623', '#D4890E'],
      btnText: '#0F172A',
      icon: 'sparkles',
      iconColor: '#FDE68A',
    },
    crimson: {
      gradient: ['#881337', '#9F1239', '#BE123C'],
      borderColor: '#F43F5E',
      badgeBg: '#F43F5E',
      badgeText: '#FFFFFF',
      btnGradient: ['#F43F5E', '#E11D48'],
      btnText: '#FFFFFF',
      icon: 'flash',
      iconColor: '#FECDD3',
    },
    indigo: {
      gradient: ['#312E81', '#3730A3', '#4338CA'],
      borderColor: '#6366F1',
      badgeBg: '#6366F1',
      badgeText: '#FFFFFF',
      btnGradient: ['#6366F1', '#4F46E5'],
      btnText: '#FFFFFF',
      icon: 'gift',
      iconColor: '#C7D2FE',
    },
  };

  const cfg = themeConfigs[theme] || themeConfigs.amber;
  const badgeText = offer.badge || 'HOT DEAL 🔥';
  const titleText = offer.title || 'Special Limited Offer!';
  const descText = offer.description || 'Tap now to claim this exclusive discount before it expires!';
  const btnText = offer.button_text || 'Buy Now ➔';

  return (
    <View style={[styles.container, isDesktop && styles.containerDesktop]}>
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={handlePress}
        style={styles.cardTouch}
      >
        <LinearGradient
          colors={cfg.gradient as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.card, { borderColor: cfg.borderColor }]}
        >
          {/* Left: Animated Icon */}
          <View style={styles.iconWrap}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(255, 255, 255, 0.15)' }]}>
                <Ionicons name={cfg.icon as any} size={20} color={cfg.iconColor} />
              </View>
            </Animated.View>
          </View>

          {/* Center: Badge, Title & Description */}
          <View style={styles.contentCol}>
            <View style={styles.topRow}>
              <View style={[styles.badge, { backgroundColor: cfg.badgeBg }]}>
                <Text style={[styles.badgeText, { color: cfg.badgeText }]}>
                  {badgeText}
                </Text>
              </View>
              <Text style={styles.title} numberOfLines={1}>
                {titleText}
              </Text>
            </View>

            {descText ? (
              <Text style={styles.description} numberOfLines={isDesktop ? 2 : 1}>
                {descText}
              </Text>
            ) : null}
          </View>

          {/* Right: Buy Now CTA Button */}
          <View style={styles.actionCol}>
            <LinearGradient
              colors={cfg.btnGradient as any}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buyBtn}
            >
              <Text style={[styles.buyBtnText, { color: cfg.btnText }]}>
                {btnText}
              </Text>
            </LinearGradient>
          </View>

          {/* Dismiss Button */}
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              handleDismiss();
            }}
            style={styles.closeBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={14} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 10,
    marginTop: 4,
  },
  containerDesktop: {
    marginHorizontal: 0,
    maxWidth: 860,
    width: '100%',
    alignSelf: 'center',
  },
  cardTouch: {
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.2,
    position: 'relative',
    overflow: 'hidden',
  },
  iconWrap: {
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  contentCol: {
    flex: 1,
    justifyContent: 'center',
    marginRight: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    marginBottom: 2,
    gap: 6,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    flex: 1,
  },
  description: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 15,
    fontWeight: '500',
  },
  actionCol: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 14,
  },
  buyBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  buyBtnText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  closeBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
