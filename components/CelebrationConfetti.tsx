import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import {
  View, Text, StyleSheet, Dimensions, Animated, Easing,
  Platform, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface CelebrationSettings {
  is_enabled: boolean;
  event_type: 'eid' | 'new_year' | 'independence' | 'ramadan' | 'holiday' | 'custom';
  event_title: string;
  event_subtitle: string;
  confetti_on_tap: boolean;
  show_banner: boolean;
  theme_color?: string;
}

export interface CelebrationConfettiRef {
  burst: (x?: number, y?: number) => void;
}

// Event themes preset
export const EVENT_PRESETS: Record<string, {
  name: string;
  badge: string;
  icon: string;
  defaultTitle: string;
  defaultSubtitle: string;
  primaryColor: string;
  particleColors: string[];
  particleEmojis: string[];
}> = {
  eid: {
    name: 'Eid Mubarak',
    badge: 'EID SPECIAL',
    icon: 'moon',
    defaultTitle: 'Eid Mubarak! 🌙✨',
    defaultSubtitle: 'May this blessed season bring joy, peace and prosperity to you and your family.',
    primaryColor: '#D97706',
    particleColors: ['#D97706', '#F59E0B', '#10B981', '#047857', '#FCD34D', '#FFFFFF'],
    particleEmojis: ['🌙', '⭐', '✨', '🕌', '💫'],
  },
  new_year: {
    name: 'New Year Celebration',
    badge: 'NEW YEAR',
    icon: 'sparkles',
    defaultTitle: 'Happy New Year! 🎆🎉',
    defaultSubtitle: 'Wishing you a prosperous new year filled with breakthrough and seamless transactions!',
    primaryColor: '#EF4444',
    particleColors: ['#EF4444', '#F59E0B', '#3B82F6', '#8B5CF6', '#10B981', '#EC4899', '#FCD34D'],
    particleEmojis: ['🎉', '🎆', '✨', '⭐', '🎊'],
  },
  independence: {
    name: 'Independence Day',
    badge: 'NATIONAL DAY',
    icon: 'flag',
    defaultTitle: 'Happy Independence Day! 🇳🇬',
    defaultSubtitle: 'Celebrating our nation with pride, unity, and financial empowerment.',
    primaryColor: '#16A34A',
    particleColors: ['#16A34A', '#22C55E', '#FFFFFF', '#86EFAC', '#15803D'],
    particleEmojis: ['🇳🇬', '✨', '⭐', '🎉'],
  },
  ramadan: {
    name: 'Ramadan Kareem',
    badge: 'RAMADAN',
    icon: 'moon-outline',
    defaultTitle: 'Ramadan Kareem! 🕌⭐',
    defaultSubtitle: 'May the blessings of this holy month enlighten your heart and home.',
    primaryColor: '#059669',
    particleColors: ['#059669', '#D97706', '#10B981', '#FCD34D', '#FEF3C7'],
    particleEmojis: ['🕌', '🌙', '⭐', '✨'],
  },
  holiday: {
    name: 'Holiday Festival',
    badge: 'SEASON GREETINGS',
    icon: 'gift',
    defaultTitle: 'Happy Holidays! 🎁✨',
    defaultSubtitle: 'Spread love, celebrate joy, and enjoy exclusive festive rewards.',
    primaryColor: '#DC2626',
    particleColors: ['#DC2626', '#16A34A', '#F59E0B', '#FCD34D', '#FFFFFF'],
    particleEmojis: ['🎁', '⭐', '✨', '🎉', '🌟'],
  },
  custom: {
    name: 'Special Promo / Custom',
    badge: 'SPECIAL EVENT',
    icon: 'ribbon',
    defaultTitle: 'Special Celebration! 🚀',
    defaultSubtitle: 'Welcome to our exclusive celebratory event with instant top rewards.',
    primaryColor: '#D97706',
    particleColors: ['#D97706', '#2563EB', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B'],
    particleEmojis: ['🎉', '⭐', '✨', '💎', '🚀'],
  },
};

// Internal global burst dispatcher
let globalBurstHandler: ((x?: number, y?: number) => void) | null = null;

export const triggerGlobalConfetti = (x?: number, y?: number) => {
  if (globalBurstHandler) {
    globalBurstHandler(x, y);
  }
};

interface Particle {
  id: number;
  startX: number;
  startY: number;
  color: string;
  size: number;
  isEmoji: boolean;
  emojiText?: string;
  isRibbon: boolean;
  animX: Animated.Value;
  animY: Animated.Value;
  animRotate: Animated.Value;
  animOpacity: Animated.Value;
  animScale: Animated.Value;
}

interface Props {
  settings?: CelebrationSettings | null;
  onPressBanner?: () => void;
}

const CelebrationConfetti = forwardRef<CelebrationConfettiRef, Props>(({ settings, onPressBanner }, ref) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const nextParticleId = useRef(1);

  const preset = EVENT_PRESETS[settings?.event_type || 'eid'] || EVENT_PRESETS.eid;

  const burst = (originX?: number, originY?: number) => {
    const startX = originX !== undefined ? originX : SCREEN_WIDTH / 2;
    const startY = originY !== undefined ? originY : SCREEN_HEIGHT * 0.35;

    const colors = preset.particleColors;
    const emojis = preset.particleEmojis;
    const particleCount = 28; // high particle density without lag
    const newBatch: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      const id = nextParticleId.current++;
      const isEmoji = i % 4 === 0 && emojis.length > 0;
      const emojiText = isEmoji ? emojis[i % emojis.length] : undefined;
      const isRibbon = !isEmoji && i % 2 === 0;

      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() * 0.4 - 0.2);
      const velocity = 80 + Math.random() * 160;
      const targetX = Math.cos(angle) * velocity;
      const targetY = Math.sin(angle) * velocity - (60 + Math.random() * 80);
      const fallDistance = 250 + Math.random() * 300;

      const animX = new Animated.Value(0);
      const animY = new Animated.Value(0);
      const animRotate = new Animated.Value(0);
      const animOpacity = new Animated.Value(1);
      const animScale = new Animated.Value(0.4);

      newBatch.push({
        id,
        startX,
        startY,
        color: colors[i % colors.length],
        size: isEmoji ? 20 : isRibbon ? 8 : 7,
        isEmoji,
        emojiText,
        isRibbon,
        animX,
        animY,
        animRotate,
        animOpacity,
        animScale,
      });

      // Particle physics animation
      const duration = 1200 + Math.random() * 600;
      Animated.parallel([
        Animated.timing(animScale, {
          toValue: 1,
          duration: 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.sequence([
          // Pop outward
          Animated.timing(animX, {
            toValue: targetX,
            duration: 350,
            useNativeDriver: Platform.OS !== 'web',
            easing: Easing.out(Easing.quad),
          }),
          // Float drift
          Animated.timing(animX, {
            toValue: targetX + (Math.random() * 60 - 30),
            duration: duration - 350,
            useNativeDriver: Platform.OS !== 'web',
            easing: Easing.inOut(Easing.sin),
          }),
        ]),
        Animated.sequence([
          // Jump up
          Animated.timing(animY, {
            toValue: targetY,
            duration: 350,
            useNativeDriver: Platform.OS !== 'web',
            easing: Easing.out(Easing.quad),
          }),
          // Fall down with gravity
          Animated.timing(animY, {
            toValue: targetY + fallDistance,
            duration: duration - 350,
            useNativeDriver: Platform.OS !== 'web',
            easing: Easing.in(Easing.quad),
          }),
        ]),
        Animated.timing(animRotate, {
          toValue: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 720),
          duration,
          useNativeDriver: Platform.OS !== 'web',
          easing: Easing.linear,
        }),
        Animated.sequence([
          Animated.delay(duration * 0.6),
          Animated.timing(animOpacity, {
            toValue: 0,
            duration: duration * 0.4,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]),
      ]).start(() => {
        // Cleanup particle when finished
        setParticles(prev => prev.filter(p => p.id !== id));
      });
    }

    setParticles(prev => [...prev.slice(-40), ...newBatch]);
  };

  useImperativeHandle(ref, () => ({
    burst,
  }));

  useEffect(() => {
    globalBurstHandler = burst;
    return () => {
      globalBurstHandler = null;
    };
  }, [settings?.event_type]);

  if (!settings?.is_enabled) {
    return null;
  }

  return (
    <>
      {/* ── Optional Festive Greeting Banner on Screen Top ── */}
      {settings.show_banner && (
        <TouchableOpacity
          style={[styles.bannerContainer, { borderColor: preset.primaryColor + '50' }]}
          onPress={() => {
            burst(SCREEN_WIDTH / 2, 80);
            if (onPressBanner) onPressBanner();
          }}
          activeOpacity={0.88}
        >
          <View style={[styles.badgePill, { backgroundColor: preset.primaryColor }]}>
            <Ionicons name={preset.icon as any} size={11} color="#FFFFFF" style={{ marginRight: 3 }} />
            <Text style={styles.badgeText}>{preset.badge}</Text>
          </View>

          <View style={styles.bannerTextCol}>
            <Text style={[styles.bannerTitle, { color: preset.primaryColor }]}>
              {settings.event_title || preset.defaultTitle}
            </Text>
            <Text style={styles.bannerSubtitle} numberOfLines={1}>
              {settings.event_subtitle || preset.defaultSubtitle}
            </Text>
          </View>

          <View style={[styles.sparkleBtn, { backgroundColor: preset.primaryColor + '18' }]}>
            <Ionicons name="sparkles" size={14} color={preset.primaryColor} />
          </View>
        </TouchableOpacity>
      )}

      {/* ── Confetti Particles Canvas Overlay (Non-blocking) ── */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {particles.map(p => {
          const rotateStr = p.animRotate.interpolate({
            inputRange: [-720, 720],
            outputRange: ['-720deg', '720deg'],
          });

          return (
            <Animated.View
              key={p.id}
              style={[
                styles.particle,
                {
                  left: p.startX,
                  top: p.startY,
                  opacity: p.animOpacity,
                  transform: [
                    { translateX: p.animX },
                    { translateY: p.animY },
                    { rotate: rotateStr },
                    { scale: p.animScale },
                  ],
                },
              ]}
            >
              {p.isEmoji ? (
                <Text style={{ fontSize: p.size }}>{p.emojiText}</Text>
              ) : p.isRibbon ? (
                <View
                  style={{
                    width: p.size * 1.8,
                    height: p.size * 0.7,
                    backgroundColor: p.color,
                    borderRadius: 2,
                  }}
                />
              ) : (
                <View
                  style={{
                    width: p.size,
                    height: p.size,
                    backgroundColor: p.color,
                    borderRadius: p.size / 2,
                  }}
                />
              )}
            </Animated.View>
          );
        })}
      </View>
    </>
  );
});

export default CelebrationConfetti;

const styles = StyleSheet.create({
  bannerContainer: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 10,
  },
  badgeText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  bannerTextCol: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 1,
  },
  bannerSubtitle: {
    fontSize: 9.5,
    color: '#64748B',
    fontWeight: '600',
  },
  sparkleBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  particle: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
