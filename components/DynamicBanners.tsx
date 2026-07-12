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
      let query = supabase
        .from('banners')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
        
      if (placement === 'dashboard') {
         query = query.or(`placement.ilike.%dashboard%,placement.is.null`);
      } else {
         query = query.ilike('placement', `%${placement}%`);
      }

      const { data } = await query;
      if (data) setActiveBanners(data);
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
            className={`rounded-2xl overflow-hidden bg-white shadow-sm border border-slate-200 justify-center`}
            style={{ width: W - 32, height: 60, marginRight: 12 }}
          >
            {item.image_url ? (
              <Image source={{ uri: item.image_url }} className="w-full h-full" resizeMode="cover" />
            ) : (
              <LinearGradient colors={['#0f172a', '#1e293b']} start={{x:0,y:0}} end={{x:1,y:1}} className="w-full h-full flex-row items-center justify-between px-4 relative overflow-hidden">
                <View className="absolute -right-6 -top-6 w-16 h-16 bg-[#f5a623] rounded-full opacity-10" />
                <View className="flex-row items-center z-10">
                   <Text className="text-white font-bold text-sm tracking-tight" numberOfLines={1}>{item.title}</Text>
                </View>
                <Text className="text-[#94a3b8] font-medium text-[10px] z-10">Tap for details ➔</Text>
              </LinearGradient>
            )}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
