import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  Dimensions,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../services/supabase';

// ─── Layout ───────────────────────────────────────────────────────────────────
const { width: SCREEN_W } = Dimensions.get('window');
const H_PADDING   = 16;                              // Side padding (card style)
const BANNER_W    = SCREEN_W - H_PADDING * 2;        // Width with padding
const BANNER_H    = 112;                             // Slim height
const GAP         = 12;                              // Space between banners
const STRIDE      = BANNER_W + GAP;
const RADIUS      = 14;                              // Card border radius
const AUTO_MS     = 4000;

interface Banner {
  id: string;
  title?: string;
  subtitle?: string;
  description?: string;
  image_url?: string;
  target_url?: string;
  is_active: boolean;
  placement?: string;
}

export default function DynamicBanners({ placement = 'dashboard' }: { placement?: string }) {
  const [banners, setBanners]             = useState<Banner[]>([]);
  const [index, setIndex]                 = useState(0);
  const [loading, setLoading]             = useState(true);
  const [imgErrors, setImgErrors]         = useState<Record<string, boolean>>({});

  const listRef      = useRef<FlatList>(null);
  const touching     = useRef(false);
  const timer        = useRef<ReturnType<typeof setInterval> | null>(null);
  const router       = useRouter();

  // ─── Fetch ────────────────────────────────────────────────────────────────
  const fetchBanners = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error || !data?.length) { setBanners([]); return; }

      const filtered = data.filter((b: Banner) => {
        const p = String(b.placement || '').toLowerCase().trim();
        if (!p || p.includes('all') || p.includes('dashboard')) return true;
        return placement && p.includes(placement.toLowerCase());
      });
      setBanners(filtered.length ? filtered : data);
    } catch (e) {
      console.warn('DynamicBanners:', e);
    } finally {
      setLoading(false);
    }
  }, [placement]);

  useEffect(() => { fetchBanners(); }, [fetchBanners]);

  // ─── Auto-scroll ──────────────────────────────────────────────────────────
  const startTimer = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      if (touching.current) return;
      setIndex(prev => {
        const next = (prev + 1) % banners.length;
        try {
          listRef.current?.scrollToOffset({ offset: next * STRIDE, animated: true });
        } catch (_) {}
        return next;
      });
    }, AUTO_MS);
  }, [banners.length]);

  useEffect(() => {
    if (banners.length > 1) startTimer();
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [banners.length, startTimer]);

  const onScrollEnd = useCallback((e: any) => {
    const x   = e.nativeEvent?.contentOffset?.x ?? 0;
    const idx = Math.round(x / STRIDE);
    if (idx >= 0 && idx < banners.length) setIndex(idx);
  }, [banners.length]);

  const onPress = useCallback((b: Banner) => {
    supabase.rpc('increment_banner_click', { banner_id: b.id }).then(({ error }) => {
      if (error) console.log('Banner click track:', error);
    });
    if (b.target_url) {
      try { router.push(b.target_url as any); } catch (_) {}
    }
  }, [router]);

  // ─── Guards ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.loadingWrap}>
        <View style={s.loadingCard}>
          <ActivityIndicator size="small" color="#F59E0B" />
        </View>
      </View>
    );
  }
  if (!banners.length) return null;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <FlatList
        ref={listRef}
        data={banners}
        horizontal
        showsHorizontalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        decelerationRate="fast"
        snapToInterval={STRIDE}
        snapToAlignment="start"
        keyExtractor={(item, i) => item?.id ?? String(i)}
        contentContainerStyle={s.listContent}
        getItemLayout={(_, i) => ({ length: STRIDE, offset: STRIDE * i, index: i })}
        onMomentumScrollEnd={onScrollEnd}
        onScrollBeginDrag={() => {
          touching.current = true;
          if (timer.current) clearInterval(timer.current);
        }}
        onScrollEndDrag={() => {
          setTimeout(() => {
            touching.current = false;
            if (banners.length > 1) startTimer();
          }, 2000);
        }}
        renderItem={({ item }) => {
          const hasImg =
            typeof item?.image_url === 'string' &&
            item.image_url.trim().length > 0 &&
            !imgErrors[item.id];

          return (
            <TouchableOpacity
              onPress={() => onPress(item)}
              activeOpacity={item.target_url ? 0.9 : 1}
              style={s.card}
              accessible
              accessibilityRole="button"
              accessibilityLabel={item.title || 'Banner'}
            >
              {hasImg ? (
                // ── Pure Image — ZERO overlays, ZERO text on top ────────────
                <Image
                  source={{ uri: item.image_url }}
                  style={s.img}
                  resizeMode="cover"
                  onError={() =>
                    setImgErrors(prev => ({ ...prev, [item.id]: true }))
                  }
                />
              ) : (
                // ── Fallback: Premium gradient (no image) ───────────────────
                <LinearGradient
                  colors={['#0B1437', '#112060', '#0B1437']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.fallback}
                >
                  {/* Subtle glow orb */}
                  <View style={s.orb} pointerEvents="none" />

                  <View style={s.fbLeft}>
                    <Text style={s.fbTitle} numberOfLines={1}>
                      {item.title || 'Special Offer'}
                    </Text>
                    <Text style={s.fbSub} numberOfLines={2}>
                      {item.subtitle || item.description || 'Tap to explore.'}
                    </Text>
                  </View>

                  {item.target_url ? (
                    <View style={s.fbArrow}>
                      <Ionicons name="chevron-forward" size={18} color="#F59E0B" />
                    </View>
                  ) : null}
                </LinearGradient>
              )}
            </TouchableOpacity>
          );
        }}
      />

      {/* Pagination dots */}
      {banners.length > 1 && (
        <View style={s.dots}>
          {banners.map((_, i) => (
            <TouchableOpacity
              key={i}
              hitSlop={{ top: 8, bottom: 8, left: 5, right: 5 }}
              onPress={() => {
                setIndex(i);
                try {
                  listRef.current?.scrollToOffset({ offset: i * STRIDE, animated: true });
                } catch (_) {}
              }}
            >
              <View style={[s.dot, i === index ? s.dotOn : s.dotOff]} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    marginTop: 10,
    marginBottom: 2,
  },

  listContent: {
    paddingHorizontal: H_PADDING,   // ✅ Clean card padding on both sides
    gap: GAP,                        // Space between slides
  },

  // Banner card — slim, rounded, shadowed
  card: {
    width: BANNER_W,
    height: BANNER_H,
    borderRadius: RADIUS,
    overflow: 'hidden',
    backgroundColor: '#0B1437',
    // Premium shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 6,
  },

  // ── Pure image — fills card completely, no overlays ──
  img: {
    width: '100%',
    height: '100%',
  },

  // ── Fallback gradient ──
  fallback: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    right: -30,
    top: -30,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(245,166,35,0.07)',
  },
  fbLeft: {
    flex: 1,
    paddingRight: 12,
  },
  fbTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.1,
    marginBottom: 5,
  },
  fbSub: {
    color: 'rgba(148,163,184,0.85)',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
  },
  fbArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(245,166,35,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Loading skeleton
  loadingWrap: {
    paddingHorizontal: H_PADDING,
    marginTop: 10,
    marginBottom: 2,
  },
  loadingCard: {
    width: BANNER_W,
    height: BANNER_H,
    borderRadius: RADIUS,
    backgroundColor: '#E8ECF4',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Pagination
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 7,
    gap: 5,
  },
  dot: {
    height: 3.5,
    borderRadius: 2,
  },
  dotOn: {
    width: 18,
    backgroundColor: '#F59E0B',
  },
  dotOff: {
    width: 4.5,
    backgroundColor: 'rgba(148,163,184,0.28)',
  },
});
