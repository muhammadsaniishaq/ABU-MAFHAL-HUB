import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../services/supabase';

// ─── Constants ─────────────────────────────────────────────────────────────────
const RADIUS = 12;
const GAP = 12;
const AUTO_MS = 4500;

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
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && windowWidth >= 768;

  // Responsive sizing:
  // Desktop/Laptop: 116px height, centered executive width
  // Mobile: 64px height, full phone width minus padding
  const hPadding = isDesktop ? 0 : 14;
  const bannerW = isDesktop
    ? Math.min(windowWidth - 48, 860)
    : Math.max(windowWidth - 28, 280);
  const bannerH = isDesktop ? 116 : 64;
  const stride = bannerW + GAP;

  const [banners, setBanners] = useState<Banner[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  const listRef = useRef<FlatList>(null);
  const touching = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  // ─── Fetch & Device-Aware Filter ──────────────────────────────────────────
  const fetchBanners = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error || !data?.length) {
        setBanners([]);
        return;
      }

      // Filter by device type and placement
      const filtered = data.filter((b: Banner) => {
        const rawP = String(b.placement || '').toLowerCase().trim();
        const pList = rawP.split(',').map((item) => item.trim());

        const isMobileOnly = pList.includes('mobile_only') || pList.includes('mobile');
        const isWebDesktop =
          pList.includes('web_desktop') ||
          pList.includes('desktop') ||
          pList.includes('laptop');

        // Rule 1: Desktop/Laptop must NEVER show mobile_only banners
        if (isDesktop && isMobileOnly && !isWebDesktop) {
          return false;
        }

        // Rule 2: Mobile must NEVER show web_desktop banners
        if (!isDesktop && isWebDesktop && !isMobileOnly) {
          return false;
        }

        // Rule 3: Screen placement match (or generic all/dashboard)
        if (!rawP || pList.includes('all') || pList.includes('dashboard')) {
          return true;
        }

        return placement && pList.some((item) => item.includes(placement.toLowerCase()));
      });

      // If on desktop, check if there are desktop-exclusive banners
      if (isDesktop) {
        const desktopSpecific = filtered.filter((b) => {
          const rawP = String(b.placement || '').toLowerCase();
          return (
            rawP.includes('web_desktop') ||
            rawP.includes('desktop') ||
            rawP.includes('laptop')
          );
        });

        if (desktopSpecific.length > 0) {
          setBanners(desktopSpecific);
          return;
        }
      }

      // Clean fallback excluding cross-device pollution
      const cleanBanners = (filtered.length ? filtered : data).filter((b) => {
        const rawP = String(b.placement || '').toLowerCase();
        if (isDesktop) return !rawP.includes('mobile_only');
        return !rawP.includes('web_desktop') && !rawP.includes('desktop');
      });

      setBanners(cleanBanners);
    } catch (e) {
      console.warn('DynamicBanners:', e);
    } finally {
      setLoading(false);
    }
  }, [placement, isDesktop]);

  useEffect(() => {
    fetchBanners();

    // Live subscription to banners table
    const channel = supabase
      .channel(`banners-realtime-${placement}-${isDesktop ? 'desktop' : 'mobile'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'banners' },
        () => {
          fetchBanners();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchBanners, placement, isDesktop]);

  // ─── Auto-scroll ──────────────────────────────────────────────────────────
  const startTimer = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      if (touching.current) return;
      setIndex((prev) => {
        const next = (prev + 1) % banners.length;
        try {
          listRef.current?.scrollToOffset({ offset: next * stride, animated: true });
        } catch (_) {}
        return next;
      });
    }, AUTO_MS);
  }, [banners.length, stride]);

  useEffect(() => {
    if (banners.length > 1) startTimer();
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [banners.length, startTimer]);

  const onScrollEnd = useCallback(
    (e: any) => {
      const x = e.nativeEvent?.contentOffset?.x ?? 0;
      const idx = Math.round(x / stride);
      if (idx >= 0 && idx < banners.length) setIndex(idx);
    },
    [banners.length, stride]
  );

  const onPress = useCallback(
    (b: Banner) => {
      supabase.rpc('increment_banner_click', { banner_id: b.id }).then(({ error }) => {
        if (error) console.log('Banner click track:', error);
      });
      if (b.target_url) {
        try {
          router.push(b.target_url as any);
        } catch (_) {}
      }
    },
    [router]
  );

  // ─── Guards ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[s.loadingWrap, { paddingHorizontal: hPadding }]}>
        <View style={[s.loadingCard, { width: bannerW, height: bannerH }]}>
          <ActivityIndicator size="small" color="#F59E0B" />
        </View>
      </View>
    );
  }
  if (!banners.length) return null;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={[s.root, isDesktop && { alignSelf: 'center', width: bannerW }]}>
      <FlatList
        ref={listRef}
        data={banners}
        horizontal
        showsHorizontalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        decelerationRate="fast"
        snapToInterval={stride}
        snapToAlignment="start"
        keyExtractor={(item, i) => item?.id ?? String(i)}
        contentContainerStyle={[s.listContent, { paddingHorizontal: hPadding, gap: GAP }]}
        getItemLayout={(_, i) => ({ length: stride, offset: stride * i, index: i })}
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
              style={[s.card, { width: bannerW, height: bannerH }]}
              accessible
              accessibilityRole="button"
              accessibilityLabel={item.title || 'Banner'}
            >
              {hasImg ? (
                // ── Pure Image — ZERO overlays, shape intact ───────────────
                <Image
                  source={{ uri: item.image_url }}
                  style={s.img}
                  resizeMode="contain"
                  onError={() =>
                    setImgErrors((prev) => ({ ...prev, [item.id]: true }))
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
                  <View
                    style={[
                      s.orb,
                      isDesktop && { width: 160, height: 160, borderRadius: 80 },
                    ]}
                    pointerEvents="none"
                  />

                  <View style={s.fbLeft}>
                    <Text
                      style={[s.fbTitle, isDesktop && { fontSize: 16, marginBottom: 4 }]}
                      numberOfLines={1}
                    >
                      {item.title || 'Special Offer'}
                    </Text>
                    <Text
                      style={[
                        s.fbSub,
                        isDesktop && { fontSize: 12.5, lineHeight: 17 },
                      ]}
                      numberOfLines={2}
                    >
                      {item.subtitle || item.description || 'Tap to explore.'}
                    </Text>
                  </View>

                  {item.target_url ? (
                    <View
                      style={[
                        s.fbArrow,
                        isDesktop && { width: 36, height: 36, borderRadius: 18 },
                      ]}
                    >
                      <Ionicons
                        name="chevron-forward"
                        size={isDesktop ? 22 : 18}
                        color="#F59E0B"
                      />
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
                  listRef.current?.scrollToOffset({ offset: i * stride, animated: true });
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
    marginBottom: 4,
  },

  listContent: {
    // Dynamic padding set inline
  },

  card: {
    borderRadius: RADIUS,
    overflow: 'hidden',
    backgroundColor: '#0B1437',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },

  img: {
    width: '100%',
    height: '100%',
  },

  fallback: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    right: -20,
    top: -20,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(245,166,35,0.08)',
  },
  fbLeft: {
    flex: 1,
    paddingRight: 10,
  },
  fbTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.1,
    marginBottom: 2,
  },
  fbSub: {
    color: 'rgba(148,163,184,0.85)',
    fontSize: 9.5,
    lineHeight: 13,
    fontWeight: '500',
  },
  fbArrow: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(245,166,35,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Loading skeleton
  loadingWrap: {
    marginTop: 10,
    marginBottom: 4,
  },
  loadingCard: {
    borderRadius: RADIUS,
    backgroundColor: '#E8ECF4',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },

  // Pagination
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 8,
    gap: 5,
  },
  dot: {
    height: 3.5,
    borderRadius: 2,
  },
  dotOn: {
    width: 20,
    backgroundColor: '#F59E0B',
  },
  dotOff: {
    width: 5,
    backgroundColor: 'rgba(148,163,184,0.28)',
  },
});
