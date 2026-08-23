import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import {
  View, Text, StyleSheet, Dimensions, Animated, Easing,
  Platform, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface CelebrationSettings {
  is_enabled: boolean;
  event_type: string;
  event_title: string;
  event_subtitle: string;
  milestone_count?: string;
  confetti_on_tap: boolean;
  show_banner: boolean;
  theme_color?: string;
}

export interface CelebrationConfettiRef {
  burst: (x?: number, y?: number, force?: boolean) => void;
}

// ─── Rich Event Presets ────────────────────────────────────────────────────────
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
  milestone: {
    name: 'User Milestone / Target',
    badge: 'MILESTONE REACHED',
    icon: 'trophy',
    defaultTitle: 'Celebration! 50,000+ Active Users 🏆🥳',
    defaultSubtitle: 'Thank you for trusting us! Celebrating this massive milestone with exclusive rewards for everyone.',
    primaryColor: '#D97706',
    particleColors: ['#D97706', '#F59E0B', '#10B981', '#3B82F6', '#EC4899', '#FCD34D', '#FFFFFF'],
    particleEmojis: ['🏆', '🎉', '⭐', '💎', '🚀', '🥳'],
  },
  company_anniversary: {
    name: 'Company Anniversary',
    badge: 'ANNIVERSARY',
    icon: 'ribbon',
    defaultTitle: 'Happy Company Anniversary! 🎂💎',
    defaultSubtitle: 'Celebrating years of seamless digital finance, excellence, and unwavering user trust.',
    primaryColor: '#D97706',
    particleColors: ['#D97706', '#0F172A', '#F59E0B', '#8B5CF6', '#FCD34D', '#FFFFFF'],
    particleEmojis: ['🎂', '💎', '✨', '🎉', '🌟', '🥂'],
  },
  maulid: {
    name: 'Maulud Nabiyy',
    badge: 'MAULID NABIYY',
    icon: 'heart',
    defaultTitle: 'Maulud Mubarak! 🕌💚',
    defaultSubtitle: 'Wishing all our Muslim brothers and sisters a peaceful, joyous and blessed Maulud celebration.',
    primaryColor: '#16A34A',
    particleColors: ['#16A34A', '#22C55E', '#10B981', '#D97706', '#FCD34D', '#FFFFFF'],
    particleEmojis: ['🕌', '💚', '⭐', '✨', '🌙'],
  },
  eid: {
    name: 'Eid Mubarak',
    badge: 'EID SPECIAL',
    icon: 'moon',
    defaultTitle: 'Eid Mubarak! 🌙✨',
    defaultSubtitle: 'May this blessed season bring peace, bountiful blessings, and joy to you and your loved ones.',
    primaryColor: '#D97706',
    particleColors: ['#D97706', '#F59E0B', '#10B981', '#047857', '#FCD34D', '#FFFFFF'],
    particleEmojis: ['🌙', '⭐', '✨', '🕌', '💫'],
  },
  jummah: {
    name: 'Jumu\'at Mubarak',
    badge: 'JUMU\'AT MUBARAK',
    icon: 'sunny',
    defaultTitle: 'Jumu\'at Mubarak! 🕌✨',
    defaultSubtitle: 'May Allah accept our supplications and grant you a weekend filled with barakah.',
    primaryColor: '#059669',
    particleColors: ['#059669', '#10B981', '#D97706', '#FCD34D', '#FEF3C7'],
    particleEmojis: ['🕌', '✨', '⭐', '🌙', '🤲'],
  },
  new_year: {
    name: 'New Year Celebration',
    badge: 'NEW YEAR',
    icon: 'sparkles',
    defaultTitle: 'Happy New Year! 🎆🎉',
    defaultSubtitle: 'Wishing you a prosperous new year filled with breakthrough and seamless transactions!',
    primaryColor: '#EF4444',
    particleColors: ['#EF4444', '#F59E0B', '#3B82F6', '#8B5CF6', '#10B981', '#EC4899', '#FCD34D'],
    particleEmojis: ['🎉', '🎆', '✨', '⭐', '🎊', '🥳'],
  },
  independence: {
    name: 'Independence Day',
    badge: 'NATIONAL DAY',
    icon: 'flag',
    defaultTitle: 'Happy Independence Day! 🇳🇬',
    defaultSubtitle: 'Celebrating our nation with pride, unity, and financial empowerment for all.',
    primaryColor: '#16A34A',
    particleColors: ['#16A34A', '#22C55E', '#FFFFFF', '#86EFAC', '#15803D'],
    particleEmojis: ['🇳🇬', '✨', '⭐', '🎉', '🦅'],
  },
  ramadan: {
    name: 'Ramadan Kareem',
    badge: 'RAMADAN KAREEM',
    icon: 'moon-outline',
    defaultTitle: 'Ramadan Kareem! 🕌⭐',
    defaultSubtitle: 'May the blessings of this holy month enlighten your heart and bring boundless ease.',
    primaryColor: '#059669',
    particleColors: ['#059669', '#D97706', '#10B981', '#FCD34D', '#FEF3C7'],
    particleEmojis: ['🕌', '🌙', '⭐', '✨'],
  },
  black_friday: {
    name: 'Mega Promo / Sale',
    badge: 'MEGA SALE',
    icon: 'flash',
    defaultTitle: 'Mega Discount Splash! 💥🛍️',
    defaultSubtitle: 'Enjoy the lowest rates on data, airtime and bills all day long!',
    primaryColor: '#DC2626',
    particleColors: ['#DC2626', '#D97706', '#0F172A', '#F59E0B', '#FFFFFF'],
    particleEmojis: ['💥', '🛍️', '🔥', '🎁', '⚡'],
  },
  holiday: {
    name: 'Holiday Festival',
    badge: 'SEASON GREETINGS',
    icon: 'gift',
    defaultTitle: 'Happy Holidays! 🎁✨',
    defaultSubtitle: 'Spread love, celebrate joy, and enjoy exclusive festive bonus cashback.',
    primaryColor: '#DC2626',
    particleColors: ['#DC2626', '#16A34A', '#F59E0B', '#FCD34D', '#FFFFFF'],
    particleEmojis: ['🎁', '⭐', '✨', '🎉', '🌟'],
  },
  custom: {
    name: 'Custom Celebration',
    badge: 'SPECIAL EVENT',
    icon: 'ribbon',
    defaultTitle: 'Special Celebration! 🚀',
    defaultSubtitle: 'Welcome to our exclusive celebratory event with instant top rewards.',
    primaryColor: '#D97706',
    particleColors: ['#D97706', '#2563EB', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B'],
    particleEmojis: ['🎉', '⭐', '✨', '💎', '🚀'],
  },
};

// Global lightweight burst handler
let activeBurstHandler: ((x?: number, y?: number, force?: boolean) => void) | null = null;
let lastBurstTimestamp = 0;

export const triggerGlobalConfetti = (x?: number, y?: number, force?: boolean) => {
  const now = Date.now();
  if (now - lastBurstTimestamp > 300) {
    lastBurstTimestamp = now;
    if (activeBurstHandler) {
      activeBurstHandler(x, y, force);
    }
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
}

interface Props {
  settings?: CelebrationSettings | null;
  onPressBanner?: () => void;
  autoListenSupabase?: boolean;
}

const CelebrationConfetti = forwardRef<CelebrationConfettiRef, Props>(({ settings: propSettings, onPressBanner, autoListenSupabase = true }, ref) => {
  const [liveSettings, setLiveSettings] = useState<CelebrationSettings | null>(propSettings || null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const nextParticleId = useRef(1);

  useEffect(() => {
    if (propSettings !== undefined) {
      setLiveSettings(propSettings);
    }
  }, [propSettings]);

  useEffect(() => {
    if (!autoListenSupabase) return;

    const loadInitial = async () => {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'celebration_event_settings')
          .single();

        if (data?.value) {
          const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
          if (parsed && typeof parsed === 'object') {
            setLiveSettings(parsed);
          }
        }
      } catch (e) {}
    };
    loadInitial();

    const channel = supabase
      .channel('realtime_confetti_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_settings', filter: 'key=eq.celebration_event_settings' },
        (payload: any) => {
          if (payload.new?.value) {
            try {
              const parsed = typeof payload.new.value === 'string' ? JSON.parse(payload.new.value) : payload.new.value;
              if (parsed && typeof parsed === 'object') {
                setLiveSettings(parsed);
                // Clear any existing active particles immediately if turned off!
                if (!parsed.is_enabled) {
                  setParticles([]);
                }
              }
            } catch (e) {}
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [autoListenSupabase]);

  const activeSettings = liveSettings !== null ? liveSettings : propSettings;
  const isEnabled = Boolean(activeSettings && activeSettings.is_enabled === true);

  const burst = (originX?: number, originY?: number, force?: boolean) => {
    // STRICT CHECK: Never fire if disabled unless explicitly forced from admin preview
    if (!force) {
      if (!isEnabled) return;
      if (activeSettings && activeSettings.confetti_on_tap === false) return;
    }

    const preset = EVENT_PRESETS[activeSettings?.event_type || 'eid'] || EVENT_PRESETS.eid;
    const startX = originX !== undefined ? originX : SCREEN_WIDTH / 2;
    const startY = originY !== undefined ? originY : SCREEN_HEIGHT * 0.35;

    const colors = preset.particleColors;
    const emojis = preset.particleEmojis;
    const particleCount = 16; // ultra-lightweight
    const newBatch: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      const id = nextParticleId.current++;
      const isEmoji = i % 4 === 0 && emojis.length > 0;
      const emojiText = isEmoji ? emojis[i % emojis.length] : undefined;
      const isRibbon = !isEmoji && i % 2 === 0;

      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() * 0.4 - 0.2);
      const velocity = 65 + Math.random() * 110;
      const targetX = Math.cos(angle) * velocity;
      const targetY = Math.sin(angle) * velocity - (45 + Math.random() * 65);
      const fallDistance = 180 + Math.random() * 200;

      const animX = new Animated.Value(0);
      const animY = new Animated.Value(0);
      const animRotate = new Animated.Value(0);
      const animOpacity = new Animated.Value(1);

      newBatch.push({
        id,
        startX,
        startY,
        color: colors[i % colors.length],
        size: isEmoji ? 16 : isRibbon ? 7 : 6,
        isEmoji,
        emojiText,
        isRibbon,
        animX,
        animY,
        animRotate,
        animOpacity,
      });

      const duration = 850 + Math.random() * 350;
      Animated.parallel([
        Animated.sequence([
          Animated.timing(animX, {
            toValue: targetX,
            duration: 260,
            useNativeDriver: Platform.OS !== 'web',
            easing: Easing.out(Easing.quad),
          }),
          Animated.timing(animX, {
            toValue: targetX + (Math.random() * 30 - 15),
            duration: duration - 260,
            useNativeDriver: Platform.OS !== 'web',
            easing: Easing.inOut(Easing.sin),
          }),
        ]),
        Animated.sequence([
          Animated.timing(animY, {
            toValue: targetY,
            duration: 260,
            useNativeDriver: Platform.OS !== 'web',
            easing: Easing.out(Easing.quad),
          }),
          Animated.timing(animY, {
            toValue: targetY + fallDistance,
            duration: duration - 260,
            useNativeDriver: Platform.OS !== 'web',
            easing: Easing.in(Easing.quad),
          }),
        ]),
        Animated.timing(animRotate, {
          toValue: (Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 360),
          duration,
          useNativeDriver: Platform.OS !== 'web',
          easing: Easing.linear,
        }),
        Animated.sequence([
          Animated.delay(duration * 0.55),
          Animated.timing(animOpacity, {
            toValue: 0,
            duration: duration * 0.45,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]),
      ]).start(() => {
        setParticles(prev => prev.filter(p => p.id !== id));
      });
    }

    setParticles(prev => [...prev.slice(-25), ...newBatch]);
  };

  useImperativeHandle(ref, () => ({
    burst,
  }));

  useEffect(() => {
    activeBurstHandler = burst;
    return () => {
      activeBurstHandler = null;
    };
  });

  const preset = EVENT_PRESETS[activeSettings?.event_type || 'eid'] || EVENT_PRESETS.eid;

  return (
    <>
      {/* ── Optional Festive Greeting Banner on Screen Top ── */}
      {isEnabled && activeSettings?.show_banner && (
        <TouchableOpacity
          style={[styles.bannerContainer, { borderColor: preset.primaryColor + '50' }]}
          onPress={() => {
            burst(SCREEN_WIDTH / 2, 80, true);
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
              {activeSettings.event_title || preset.defaultTitle}
            </Text>
            <Text style={styles.bannerSubtitle} numberOfLines={1}>
              {activeSettings.event_subtitle || preset.defaultSubtitle}
            </Text>
          </View>

          <View style={[styles.sparkleBtn, { backgroundColor: preset.primaryColor + '18' }]}>
            <Ionicons name="sparkles" size={14} color={preset.primaryColor} />
          </View>
        </TouchableOpacity>
      )}

      {/* ── Non-blocking Particles Canvas (Only renders when particles exist) ── */}
      {particles.length > 0 && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {particles.map(p => {
            const rotateStr = p.animRotate.interpolate({
              inputRange: [-360, 360],
              outputRange: ['-360deg', '360deg'],
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
                    ],
                  },
                ]}
              >
                {p.isEmoji ? (
                  <Text style={{ fontSize: p.size }}>{p.emojiText}</Text>
                ) : p.isRibbon ? (
                  <View style={{ width: p.size * 1.8, height: p.size * 0.7, backgroundColor: p.color, borderRadius: 2 }} />
                ) : (
                  <View style={{ width: p.size, height: p.size, backgroundColor: p.color, borderRadius: p.size / 2 }} />
                )}
              </Animated.View>
            );
          })}
        </View>
      )}
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
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
