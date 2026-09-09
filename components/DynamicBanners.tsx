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
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../services/supabase';

// ─── Full-bleed layout: zero padding, zero cropping ───────────────────────────
const SCREEN_WIDTH    = Dimensions.get('window').width;
const BANNER_WIDTH    = SCREEN_WIDTH;          // 100% screen — no side gaps
const BANNER_HEIGHT   = 160;                   // Comfortable height for all images
const ITEM_STRIDE     = SCREEN_WIDTH;          // Exact stride — no inter-item gaps
const AUTO_INTERVAL   = 3800;

// ─── Types ────────────────────────────────────────────────────────────────────
interface Banner {
  id: string;
  title?: string;
  subtitle?: string;
  description?: string;
  image_url?: string;
  target_url?: string;
  is_active: boolean;
  placement?: string;
  clicks?: number;
  created_at?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function DynamicBanners({ placement = 'dashboard' }: { placement?: string }) {
  const [banners, setBanners]         = useState<Banner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading]     = useState(true);
  const [imgErrors, setImgErrors]     = useState<Record<string, boolean>>({});

  const listRef        = useRef<FlatList>(null);
  const userTouching   = useRef(false);
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const router         = useRouter();

  // ─── Fetch banners ──────────────────────────────────────────────────────────
  const fetchBanners = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) { console.warn('DynamicBanners:', error.message); return; }

      if (data && data.length > 0) {
        const matched = data.filter((b: Banner) => {
          const p = String(b.placement || '').toLowerCase().trim();
          if (!p || p.includes('all') || p.includes('dashboard')) return true;
          return placement && p.includes(String(placement).toLowerCase());
        });
        setBanners(matched.length > 0 ? matched : data);
      } else {
        setBanners([]);
      }
    } catch (e) {
      console.warn('DynamicBanners exception:', e);
    } finally {
      setIsLoading(false);
    }
  }, [placement]);

  useEffect(() => { fetchBanners(); }, [fetchBanners]);

  // ─── Auto-scroll ────────────────────────────────────────────────────────────
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (userTouching.current || banners.length <= 1) return;
      setCurrentIndex(prev => {
        const next = (prev + 1) % banners.length;
        try {
          listRef.current?.scrollToOffset({ offset: next * ITEM_STRIDE, animated: true });
        } catch (_) {}
        return next;
      });
    }, AUTO_INTERVAL);
  }, [banners.length]);

  useEffect(() => {
    if (banners.length > 1) startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [banners.length, startTimer]);

  // ─── Scroll sync ────────────────────────────────────────────────────────────
  const onScrollEnd = useCallback((e: any) => {
    const x = e.nativeEvent?.contentOffset?.x ?? 0;
    const idx = Math.round(x / ITEM_STRIDE);
    if (idx >= 0 && idx < banners.length) setCurrentIndex(idx);
  }, [banners.length]);

  // ─── Banner click ───────────────────────────────────────────────────────────
  const onBannerPress = useCallback((banner: Banner) => {
    if (!banner?.id) return;
    supabase.rpc('increment_banner_click', { banner_id: banner.id })
      .then(({ error }) => { if (error) console.log('Banner click:', error); });
    if (banner.target_url) {
      try { router.push(banner.target_url as any); } catch (_) {}
    }
  }, [router]);

  // ─── Guard: Loading ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="small" color="#F59E0B" />
      </View>
    );
  }

  if (!banners || banners.length === 0) return null;

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.wrapper}>
      <FlatList
        ref={listRef}
        data={banners}
        horizontal
        pagingEnabled                          // ✅ Snap to each banner exactly
        showsHorizontalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        keyExtractor={(item, i) => item?.id ? String(item.id) : String(i)}
        // ✅ NO padding at all — full bleed
        contentContainerStyle={styles.flatListContent}
        getItemLayout={(_, index) => ({
          length: ITEM_STRIDE,
          offset: ITEM_STRIDE * index,
          index,
        })}
        onMomentumScrollEnd={onScrollEnd}
        onScrollBeginDrag={() => {
          userTouching.current = true;
          if (timerRef.current) clearInterval(timerRef.current);
        }}
        onScrollEndDrag={() => {
          setTimeout(() => {
            userTouching.current = false;
            if (banners.length > 1) startTimer();
          }, 2500);
        }}
        renderItem={({ item }) => {
          const hasImage =
            typeof item?.image_url === 'string' &&
            item.image_url.trim().length > 0 &&
            !imgErrors[item.id];

          return (
            <TouchableOpacity
              onPress={() => onBannerPress(item)}
              activeOpacity={item.target_url ? 0.92 : 1}
              style={styles.bannerItem}
              accessible
              accessibilityRole="button"
              accessibilityLabel={item.title || 'Promotional banner'}
            >
              {hasImage ? (
                // ── Image Banner: ZERO crop, ZERO padding ─────────────────────
                <View style={styles.imageWrap}>
                  <Image
                    source={{ uri: item.image_url }}
                    style={styles.bannerImage}
                    resizeMode="contain"     // ✅ NEVER crops — full image always shown
                    onError={() =>
                      setImgErrors(prev => ({ ...prev, [item.id]: true }))
                    }
                  />
                </View>
              ) : (
                // ── Fallback Gradient Banner ──────────────────────────────────
                <LinearGradient
                  colors={['#060D1F', '#0D1B3E', '#112060']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.fallback}
                >
                  {/* Gold left accent strip */}
                  <View style={styles.accentStrip} />

                  {/* Content */}
                  <View style={styles.fallbackBody}>
                    <View style={styles.pillRow}>
                      <View style={styles.pill}>
                        <Text style={styles.pillText}>🔥 SPECIAL OFFER</Text>
                      </View>
                    </View>
                    <Text style={styles.fallbackTitle} numberOfLines={2}>
                      {item.title || 'Exclusive Offer — Limited Time'}
                    </Text>
                    <Text style={styles.fallbackSub} numberOfLines={2}>
                      {item.subtitle || item.description || 'Tap to explore and claim now.'}
                    </Text>
                  </View>

                  {/* CTA */}
                  {item.target_url ? (
                    <View style={styles.cta}>
                      <Ionicons name="arrow-forward-circle" size={22} color="#F59E0B" />
                    </View>
                  ) : null}

                  {/* Decorative orb */}
                  <View style={styles.decorOrb} pointerEvents="none" />
                </LinearGradient>
              )}
            </TouchableOpacity>
          );
        }}
      />

      {/* ── Pagination Dots ─────────────────────────────────────────────────── */}
      {banners.length > 1 && (
        <View style={styles.dotsRow} pointerEvents="box-none">
          {banners.map((_, idx) => (
            <TouchableOpacity
              key={idx}
              hitSlop={{ top: 8, bottom: 8, left: 5, right: 5 }}
              onPress={() => {
                setCurrentIndex(idx);
                try {
                  listRef.current?.scrollToOffset({
                    offset: idx * ITEM_STRIDE,
                    animated: true,
                  });
                } catch (_) {}
              }}
            >
              <View
                style={[
                  styles.dot,
                  currentIndex === idx ? styles.dotActive : styles.dotIdle,
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Outer wrapper — no margin, no padding
  wrapper: {
    width: SCREEN_WIDTH,        // ✅ Full screen width
    marginLeft: 0,
    marginRight: 0,
    backgroundColor: 'transparent',
  },

  // Loading placeholder
  loadingBox: {
    width: SCREEN_WIDTH,
    height: BANNER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },

  // FlatList content — NO horizontal padding
  flatListContent: {
    paddingHorizontal: 0,       // ✅ Zero padding — edge to edge
  },

  // Each banner slide
  bannerItem: {
    width: BANNER_WIDTH,        // ✅ Exactly screen width — no gaps
    height: BANNER_HEIGHT,
    overflow: 'hidden',
    backgroundColor: '#000',
  },

  // Image container — fills 100%
  imageWrap: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',   // Black letterbox (clean) when image doesn't fill
  },

  // Image — full container, no crop
  bannerImage: {
    width: '100%',
    height: '100%',            // ✅ resizeMode="contain" — ZERO cropping
  },

  // Fallback gradient banner
  fallback: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    overflow: 'hidden',
  },
  accentStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#F59E0B',
  },
  decorOrb: {
    position: 'absolute',
    right: -40,
    top: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(245, 166, 35, 0.06)',
  },
  fallbackBody: {
    flex: 1,
    paddingLeft: 8,
  },
  pillRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  pill: {
    backgroundColor: 'rgba(245, 159, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pillText: {
    color: '#F59E0B',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  fallbackTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
    marginBottom: 6,
    letterSpacing: 0.1,
  },
  fallbackSub: {
    color: 'rgba(148,163,184,0.9)',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
  },
  cta: {
    marginLeft: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Pagination dots
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 7,
    gap: 5,
  },
  dot: {
    height: 4,
    borderRadius: 2,
  },
  dotActive: {
    width: 22,
    backgroundColor: '#F59E0B',
  },
  dotIdle: {
    width: 5,
    backgroundColor: 'rgba(148,163,184,0.3)',
  },
});
