import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, FlatList, Image, Dimensions, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { supabase } from '../services/supabase';

const { width: W } = Dimensions.get('window');
const BANNER_WIDTH = Math.min(W - 24, 460);
const BANNER_HEIGHT = 62; // Ultra-slim modern fintech ribbon
const BANNER_MARGIN = 8;
const ITEM_STRIDE = BANNER_WIDTH + BANNER_MARGIN;

export default function DynamicBanners({ placement = 'dashboard' }: { placement?: string }) {
  const [activeBanners, setActiveBanners] = useState<any[]>([]);
  const bannerRef = useRef<FlatList>(null);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const isUserTouching = useRef(false);
  const router = useRouter();

  useEffect(() => {
    fetchActiveBanners();
  }, [placement]);

  // Robust Auto-Scroll Timer running smoothly across all devices
  useEffect(() => {
    if (activeBanners.length <= 1) return;

    const interval = setInterval(() => {
      if (isUserTouching.current) return;

      setCurrentBannerIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % activeBanners.length;
        try {
          bannerRef.current?.scrollToOffset({
            offset: nextIndex * ITEM_STRIDE,
            animated: true,
          });
        } catch (e) {
          console.log('Banner auto scroll notice:', e);
        }
        return nextIndex;
      });
    }, 3800);

    return () => clearInterval(interval);
  }, [activeBanners.length]);

  const fetchActiveBanners = async () => {
    try {
      const { data } = await supabase
        .from('banners')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (data && data.length > 0) {
        const matched = data.filter((b: any) => {
          if (!b.placement || b.placement.toLowerCase().includes('all') || b.placement.toLowerCase().includes('dashboard')) return true;
          if (placement && b.placement.toLowerCase().includes(placement.toLowerCase())) return true;
          return false;
        });
        setActiveBanners(matched.length > 0 ? matched : data);
      }
    } catch (e) {
      console.warn("Error fetching banners", e);
    }
  };

  const handleBannerClick = async (banner: any) => {
    supabase.rpc('increment_banner_click', { banner_id: banner.id }).then(({ error }) => {
      if (error) console.log('Banner click track error:', error);
    });
    if (banner.target_url) {
      router.push(banner.target_url);
    }
  };

  const handleScrollEnd = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / ITEM_STRIDE);
    if (index >= 0 && index < activeBanners.length) {
      setCurrentBannerIndex(index);
    }
  };

  if (activeBanners.length === 0) return null;

  return (
    <View style={styles.container}>
      <FlatList
        ref={bannerRef}
        data={activeBanners}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        decelerationRate="fast"
        snapToInterval={ITEM_STRIDE}
        snapToAlignment="start"
        contentContainerStyle={{ paddingHorizontal: 12 }}
        getItemLayout={(_, index) => ({
          length: ITEM_STRIDE,
          offset: ITEM_STRIDE * index,
          index,
        })}
        onMomentumScrollEnd={handleScrollEnd}
        onTouchStart={() => { isUserTouching.current = true; }}
        onTouchEnd={() => { setTimeout(() => { isUserTouching.current = false; }, 2500); }}
        renderItem={({ item }) => (
          <TouchableOpacity 
            onPress={() => handleBannerClick(item)}
            activeOpacity={0.92}
            style={styles.bannerCard}
          >
            {item.image_url ? (
              <View style={styles.imageContainer}>
                <Image 
                  source={{ uri: item.image_url }} 
                  style={styles.bannerImage} 
                  resizeMode="cover" 
                />
              </View>
            ) : (
              <LinearGradient 
                colors={['#0F172A', '#1E293B', '#0B132B']} 
                start={{ x: 0, y: 0 }} 
                end={{ x: 1, y: 1 }} 
                style={styles.fallbackGradient}
              >
                <View style={{ flex: 1, marginRight: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <View style={styles.promoPill}>
                      <Text style={styles.promoPillText}>SPECIAL OFFER</Text>
                    </View>
                    <Text style={styles.brandSubtitle}>Abu Mafhal Hub</Text>
                  </View>
                  <Text style={styles.bannerTitle} numberOfLines={1}>
                    {item.title || 'Exclusive Discount Offer'}
                  </Text>
                  <Text style={styles.bannerSubtitle} numberOfLines={2}>
                    {item.subtitle || item.description || 'Tap to explore and claim this limited-time offer.'}
                  </Text>
                </View>
                <View style={styles.actionBtn}>
                  <Text style={styles.actionBtnText}>CLAIM →</Text>
                </View>
              </LinearGradient>
            )}
          </TouchableOpacity>
        )}
      />

      {/* Pagination Indicator Dots */}
      {activeBanners.length > 1 && (
        <View style={styles.paginationRow}>
          {activeBanners.map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.dot,
                currentBannerIndex === idx ? styles.activeDot : styles.inactiveDot,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
    marginBottom: 2,
    zIndex: 10,
  },
  bannerCard: {
    width: BANNER_WIDTH,
    height: BANNER_HEIGHT,
    marginRight: BANNER_MARGIN,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#070D1E',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  fallbackGradient: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  promoPill: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  promoPillText: {
    color: '#F59E0B',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    color: '#94A3B8',
    fontSize: 8.5,
    fontWeight: '700',
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 11.5,
    letterSpacing: 0.2,
  },
  bannerSubtitle: {
    color: '#CBD5E1',
    fontSize: 8.5,
    marginTop: 1,
  },
  actionBtn: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
  },
  actionBtnText: {
    color: '#0F172A',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  dot: {
    height: 3.5,
    borderRadius: 2,
  },
  activeDot: {
    width: 14,
    backgroundColor: '#F59E0B',
  },
  inactiveDot: {
    width: 4,
    backgroundColor: 'rgba(148, 163, 184, 0.35)',
  },
});
