import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, FlatList, Image, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { supabase } from '../services/supabase';

const { width: W } = Dimensions.get('window');

export default function DynamicBanners({ placement = 'dashboard' }: { placement?: string }) {
  const [activeBanners, setActiveBanners] = useState<any[]>([]);
  const bannerRef = useRef<FlatList>(null);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const router = useRouter();

  useEffect(() => {
    fetchActiveBanners();
  }, [placement]);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentBannerIndex(viewableItems[0].index);
    }
  }).current;

  useEffect(() => {
    if (activeBanners.length > 1) {
      const interval = setInterval(() => {
        let nextIndex = currentBannerIndex + 1;
        if (nextIndex >= activeBanners.length) {
          nextIndex = 0;
        }
        try {
          bannerRef.current?.scrollToIndex({ index: nextIndex, animated: true });
        } catch (e) {
          console.log('Scroll to index failed', e);
        }
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [currentBannerIndex, activeBanners.length]);

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

  if (activeBanners.length === 0) return null;

  return (
    <View style={{ marginTop: 12, marginBottom: 12, zIndex: 10 }}>
      <FlatList
        ref={bannerRef}
        data={activeBanners}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        pagingEnabled
        snapToInterval={W - 32 + 12} // width (W-32) + marginRight (12)
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: 16 }}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onScrollToIndexFailed={(info) => {
          const wait = new Promise(resolve => setTimeout(resolve, 500));
          wait.then(() => {
            bannerRef.current?.scrollToIndex({ index: info.index, animated: true });
          });
        }}
        renderItem={({ item }) => (
          <TouchableOpacity 
            onPress={() => handleBannerClick(item)}
            activeOpacity={0.9}
            style={{ 
              width: Math.min(W - 32, 450), 
              height: 76, 
              marginRight: 12, 
              borderRadius: 16, 
              overflow: 'hidden', 
              backgroundColor: '#0F172A', 
              borderWidth: 1, 
              borderColor: 'rgba(218, 165, 32, 0.4)',
              elevation: 4
            }}
          >
            {item.image_url ? (
              <Image 
                source={{ uri: item.image_url }} 
                style={{ width: '100%', height: '100%' }} 
                resizeMode="cover" 
              />
            ) : (
              <LinearGradient 
                colors={['#0F172A', '#1E293B', '#0B132B']} 
                start={{ x: 0, y: 0 }} 
                end={{ x: 1, y: 1 }} 
                style={{ width: '100%', height: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14 }}
              >
                <View style={{ flex: 1, marginRight: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                    <View style={{ backgroundColor: 'rgba(255, 215, 0, 0.2)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, borderWidth: 1, borderColor: '#FFD700' }}>
                      <Text style={{ color: '#FFD700', fontSize: 7, fontWeight: '900', textTransform: 'uppercase' }}>PROMO</Text>
                    </View>
                    <Text style={{ color: '#CBD5E1', fontSize: 9, fontWeight: 'bold' }}>Abu Mafhal Hub</Text>
                  </View>
                  <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 12 }} numberOfLines={1}>
                    {item.title || 'Special Promotion & Offers'}
                  </Text>
                  <Text style={{ color: '#94A3B8', fontSize: 9, marginTop: 1 }} numberOfLines={1}>
                    {item.subtitle || item.description || 'Tap to view details and claim offer'}
                  </Text>
                </View>
                <View style={{ backgroundColor: '#FFD700', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
                  <Text style={{ color: '#0F172A', fontSize: 9, fontWeight: '900' }}>VIEW →</Text>
                </View>
              </LinearGradient>
            )}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
