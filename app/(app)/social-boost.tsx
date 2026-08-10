import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Modal, FlatList, StyleSheet, Dimensions } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DynamicBanners from '../../components/DynamicBanners';
import { api } from '../../services/api';
import * as Clipboard from 'expo-clipboard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Deluxe Dark Navy & Metallic Gold Design System Tokens
const T = {
  navyDark: '#0B132B',
  navyCard: '#1C2541',
  navySubCard: '#0A0F1D',
  gold: '#F59E0B',
  goldBright: '#FBBF24',
  goldDark: '#D97706',
  goldLightBg: 'rgba(245, 158, 11, 0.12)',
  textMain: '#F8FAFC',
  textSub: '#94A3B8',
  borderGold: 'rgba(245, 158, 11, 0.35)',
  borderDark: '#334155',
  success: '#10B981',
  successBg: 'rgba(16, 185, 129, 0.15)',
  danger: '#EF4444',
  dangerBg: 'rgba(239, 68, 68, 0.15)',
  info: '#3B82F6',
  infoBg: 'rgba(59, 130, 246, 0.15)',
};

interface SMMService {
  service: string | number;
  name: string;
  category: string;
  rate: string;
  min: string | number;
  max: string | number;
}

export default function SocialBoostScreen() {
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<SMMService[]>([]);
  
  // Form State
  const [platformFilter, setPlatformFilter] = useState<string>('All');
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<SMMService | null>(null);
  const [link, setLink] = useState('');
  const [quantity, setQuantity] = useState('');
  
  // UI State
  const [serviceModal, setServiceModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);

  // Custom Decorated Alert Modal State
  const [alertModal, setAlertModal] = useState<{
    visible: boolean;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
    orderId?: string;
  }>({
    visible: false,
    type: 'info',
    title: '',
    message: ''
  });

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info', orderId?: string) => {
    setAlertModal({ visible: true, type, title, message, orderId });
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text && text.trim()) {
        setLink(text.trim());
      } else {
        showAlert("Clipboard Empty", "No text link found in your clipboard.", "info");
      }
    } catch (err) {
      console.error("Paste error:", err);
    }
  };

  const insets = useSafeAreaInsets();

  const fetchUserBalance = async (): Promise<number> => {
    try {
      // 1. Instant Cache Fallback from @dashboard_cache
      const cachedDashboard = await AsyncStorage.getItem('@dashboard_cache');
      if (cachedDashboard) {
        try {
          const parsed = JSON.parse(cachedDashboard);
          const cachedBal = parsed?.userData?.balance ?? parsed?.userData?.credit_balance;
          if (cachedBal != null) {
            const numBal = parseFloat(String(cachedBal)) || 0;
            setWalletBalance(numBal);
          }
        } catch (e) {}
      }

      // 2. Fetch active authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      let userId = user?.id;
      if (!userId) {
        const { data: { session } } = await supabase.auth.getSession();
        userId = session?.user?.id;
      }
      if (!userId) return 0;

      // 3. Query profiles table with select('*') to prevent missing column errors
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profile) {
        const rawBal = profile.balance ?? profile.credit_balance ?? profile.wallet_balance ?? 0;
        const parsedBal = parseFloat(String(rawBal)) || 0;
        setWalletBalance(parsedBal);
        
        // Keep @dashboard_cache updated
        try {
          const currentCacheStr = await AsyncStorage.getItem('@dashboard_cache');
          const currentCache = currentCacheStr ? JSON.parse(currentCacheStr) : {};
          const newCache = { 
            ...currentCache, 
            userData: { ...(currentCache.userData || {}), balance: parsedBal },
            updatedAt: Date.now() 
          };
          await AsyncStorage.setItem('@dashboard_cache', JSON.stringify(newCache));
        } catch (e) {}

        return parsedBal;
      } else if (error) {
        console.error("Profile query error:", error);
      }
    } catch (e) {
      console.error("Balance fetch error:", e);
    }
    return 0;
  };

  useEffect(() => {
    fetchUserBalance();
    fetchData();

    // Listen to Auth State changes so hydrated session updates balance instantly
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchUserBalance();
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const fetchData = async () => {
    try {
      // Load from cache for instant display
      const cachedServices = await AsyncStorage.getItem('smm_services_cache');
      if (cachedServices) {
        setServices(JSON.parse(cachedServices));
        setLoading(false);
      }

      await fetchUserBalance();

      // Fetch Services from Edge Function in background to get latest prices
      const data = await api.smm.invoke({ action: 'services' });

      if (data && data.services && data.services.length > 0) {
        setServices(data.services);
        await AsyncStorage.setItem('smm_services_cache', JSON.stringify(data.services));
      }
    } catch (error: any) {
      console.error("Error fetching services:", error);
      if (services.length === 0) {
        Alert.alert("Error", error.message || "Failed to load services");
      }
    } finally {
      setLoading(false);
    }
  };

  // Filter categories by platform filter & category search query
  const categories = useMemo(() => {
    let cats = Array.from(new Set(services.map(s => s.category.trim())));
    if (platformFilter !== 'All') {
      cats = cats.filter(c => c.toLowerCase().includes(platformFilter.toLowerCase()));
    }
    if (categorySearchQuery.trim()) {
      const q = categorySearchQuery.toLowerCase().trim();
      cats = cats.filter(c => c.toLowerCase().includes(q));
    }
    return cats.sort();
  }, [services, platformFilter, categorySearchQuery]);

  const filteredServices = useMemo(() => {
    let list = services;
    if (selectedCategory) {
      list = list.filter(s => s.category.trim() === selectedCategory);
    }
    if (modalSearchQuery.trim()) {
      const q = modalSearchQuery.toLowerCase().trim();
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q));
    }
    return list;
  }, [services, selectedCategory, modalSearchQuery]);

  const calculatePrice = () => {
    if (!selectedService || !quantity) return 0;
    const q = parseInt(quantity);
    if (isNaN(q)) return 0;
    const rate = parseFloat(selectedService.rate);
    return (rate / 1000) * q;
  };

  const totalPrice = calculatePrice();

  // Link Platform Detector
  const linkDetector = useMemo(() => {
    if (!link.trim()) return null;
    const l = link.toLowerCase();
    if (l.includes('instagram.com') || l.includes('instagr.am')) return { platform: 'Instagram', icon: 'logo-instagram', color: '#E1306C', example: 'https://instagram.com/p/username' };
    if (l.includes('tiktok.com')) return { platform: 'TikTok', icon: 'logo-tiktok', color: '#000000', example: 'https://tiktok.com/@username/video/123' };
    if (l.includes('youtube.com') || l.includes('youtu.be')) return { platform: 'YouTube', icon: 'logo-youtube', color: '#FF0000', example: 'https://youtube.com/watch?v=abc' };
    if (l.includes('facebook.com') || l.includes('fb.watch')) return { platform: 'Facebook', icon: 'logo-facebook', color: '#1877F2', example: 'https://facebook.com/posts/123' };
    if (l.includes('twitter.com') || l.includes('x.com')) return { platform: 'Twitter/X', icon: 'logo-twitter', color: '#1DA1F2', example: 'https://x.com/username/status/123' };
    if (l.includes('t.me') || l.includes('telegram.org')) return { platform: 'Telegram', icon: 'paper-plane', color: '#0088CC', example: 'https://t.me/channel/123' };
    if (l.includes('spotify.com')) return { platform: 'Spotify', icon: 'musical-notes', color: '#1DB954', example: 'https://open.spotify.com/track/123' };
    return { platform: 'Web Link', icon: 'link-outline', color: T.gold, example: 'https://example.com' };
  }, [link]);

  const handleSubmit = async () => {
    if (!selectedService) {
      showAlert("Service Required", "Please select a boost service type before proceeding.", "info");
      return;
    }
    if (!link.trim()) {
      showAlert("Target Link Required", "Please enter or paste a valid post or profile link.", "info");
      return;
    }
    
    const q = parseInt(quantity);
    if (isNaN(q) || q < parseInt(String(selectedService.min)) || q > parseInt(String(selectedService.max))) {
      showAlert("Invalid Quantity", `Quantity must be between ${selectedService.min} and ${selectedService.max}`, "info");
      return;
    }

    // Re-verify balance from DB before client check
    const freshBal = await fetchUserBalance();
    const effectiveBal = Math.max(walletBalance, freshBal);

    if (effectiveBal < totalPrice) {
      showAlert(
        "Insufficient Wallet Balance", 
        `Your current wallet balance is ₦${effectiveBal.toLocaleString(undefined, { minimumFractionDigits: 2 })}, but this order costs ₦${totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}. Please fund your wallet.`, 
        "error"
      );
      return;
    }

    setConfirmModal(true);
  };

  const placeOrder = async () => {
    try {
      setIsSubmitting(true);
      const data = await api.smm.invoke({
        action: 'place_order',
        serviceId: selectedService?.service,
        link: link.trim(),
        quantity: quantity,
        expectedPrice: totalPrice
      });

      if (data && data.error) {
        throw new Error(data.error);
      }

      showAlert("Boost Order Launched! 🚀", `Order #${data.order || 'SUCCESS'} has been placed successfully.`, "success", String(data.order || ''));
      
      setLink('');
      setQuantity('');
      setSelectedService(null);
      await fetchUserBalance();
    } catch (error: any) {
      const msg = error.message || "Could not place order";
      showAlert("Order Failed ❌", msg, "error");
    } finally {
      setIsSubmitting(false);
      setConfirmModal(false);
    }
  };

  const getPlatformIcon = (cat: string) => {
    const l = cat.toLowerCase();
    if (l.includes('instagram') || l.includes('ig')) return { name: 'logo-instagram', color: '#E1306C', bg: 'rgba(225, 48, 108, 0.15)' };
    if (l.includes('facebook') || l.includes('fb')) return { name: 'logo-facebook', color: '#1877F2', bg: 'rgba(24, 119, 242, 0.15)' };
    if (l.includes('youtube') || l.includes('yt')) return { name: 'logo-youtube', color: '#FF0000', bg: 'rgba(255, 0, 0, 0.15)' };
    if (l.includes('tiktok') || l.includes('tik')) return { name: 'logo-tiktok', color: '#FFFFFF', bg: 'rgba(255, 255, 255, 0.15)' };
    if (l.includes('twitter') || l.includes('x')) return { name: 'logo-twitter', color: '#1DA1F2', bg: 'rgba(29, 161, 242, 0.15)' };
    if (l.includes('telegram') || l.includes('tg')) return { name: 'paper-plane', color: '#0088CC', bg: 'rgba(0, 136, 204, 0.15)' };
    if (l.includes('spotify')) return { name: 'musical-notes', color: '#1DB954', bg: 'rgba(29, 185, 84, 0.15)' };
    if (l.includes('linkedin')) return { name: 'logo-linkedin', color: '#0A66C2', bg: 'rgba(10, 102, 194, 0.15)' };
    return { name: 'sparkles', color: T.gold, bg: T.goldLightBg };
  };

  if (loading) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator size="large" color={T.gold} />
        <Text style={s.loadingText}>Loading Social Boost Hub...</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Executive Dark Navy & Gold Header */}
      <LinearGradient 
        colors={['#0B132B', '#1C2541', '#334155']} 
        style={[s.header, { paddingTop: insets.top + 16, paddingBottom: 18 }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={s.iconBtn} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={18} color={T.gold} />
          </TouchableOpacity>

          <View style={s.headerTitleCol}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="sparkles" size={13} color={T.gold} style={{ marginRight: 4 }} />
              <Text style={s.headerTitle}>Social Boost Hub</Text>
            </View>
            <TouchableOpacity 
              onPress={fetchUserBalance} 
              activeOpacity={0.8}
              style={s.balanceChip}
            >
              <Ionicons name="wallet" size={11} color={T.gold} />
              <Text style={s.balanceChipText}>₦{walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
              <Ionicons name="refresh" size={9} color={T.gold} style={{ marginLeft: 3 }} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => router.push('/social-orders')} style={s.iconBtn} activeOpacity={0.8}>
            <Ionicons name="receipt-outline" size={16} color={T.gold} />
          </TouchableOpacity>
        </View>

        {/* Feature Badges Bar */}
        <View style={s.topFeatureBar}>
          {[
            { text: '⚡ 2-15 Mins Start', color: T.gold },
            { text: '🛡️ 30-Day Refill', color: T.success },
            { text: '💎 Non-Drop', color: '#60A5FA' },
            { text: '🔒 100% Safe', color: '#F472B6' },
          ].map((item, idx) => (
            <View key={idx} style={s.topFeaturePill}>
              <Text style={[s.topFeaturePillText, { color: item.color }]}>{item.text}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Dynamic Banners */}
          <DynamicBanners placement="social_boost" />
          
          {/* VIP Platform Filter Carousel */}
          <Text style={s.sectionLabel}>Select Platform</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow}>
            {[
              { id: 'All', name: 'All Platforms', icon: 'sparkles' },
              { id: 'instagram', name: 'Instagram', icon: 'logo-instagram' },
              { id: 'tiktok', name: 'TikTok', icon: 'logo-tiktok' },
              { id: 'youtube', name: 'YouTube', icon: 'logo-youtube' },
              { id: 'facebook', name: 'Facebook', icon: 'logo-facebook' },
              { id: 'twitter', name: 'Twitter / X', icon: 'logo-twitter' },
              { id: 'telegram', name: 'Telegram', icon: 'paper-plane' },
              { id: 'spotify', name: 'Spotify', icon: 'musical-notes' },
            ].map((tab) => {
              const isActive = platformFilter === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => {
                    setPlatformFilter(tab.id);
                    setSelectedCategory(null);
                    setSelectedService(null);
                  }}
                  activeOpacity={0.8}
                  style={[s.filterPill, isActive ? s.filterPillActive : null]}
                >
                  <Ionicons name={tab.icon as any} size={12} color={isActive ? T.navyDark : T.gold} />
                  <Text style={[s.filterPillText, isActive ? s.filterPillTextActive : null]}>{tab.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Direct Category Search Bar */}
          <View style={s.searchBarRow}>
            <Ionicons name="search" size={14} color={T.gold} style={{ marginRight: 6 }} />
            <TextInput
              style={s.searchBarInput}
              placeholder="Search category (e.g. Followers, Likes, Views)..."
              placeholderTextColor={T.textSub}
              value={categorySearchQuery}
              onChangeText={setCategorySearchQuery}
              autoCapitalize="none"
            />
            {categorySearchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setCategorySearchQuery('')}>
                <Ionicons name="close-circle" size={14} color={T.textSub} />
              </TouchableOpacity>
            )}
          </View>

          <View style={s.sectionHeaderRow}>
            <Text style={s.sectionLabel}>Service Categories ({categories.length})</Text>
            {selectedCategory && (
              <TouchableOpacity onPress={() => { setSelectedCategory(null); setSelectedService(null); }}>
                <Text style={s.clearCategoryText}>Clear Selection</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {/* Category Cards Grid with Dark Navy & Gold Border */}
          <View style={s.catGrid}>
            {categories.map((cat, i) => {
              const isSelected = selectedCategory === cat;
              const icon = getPlatformIcon(cat);
              return (
                <TouchableOpacity 
                  key={i} 
                  onPress={() => {
                    setSelectedCategory(cat);
                    setSelectedService(null);
                  }}
                  activeOpacity={0.7}
                  style={[s.catCard, isSelected ? s.catCardActive : null]}
                >
                  <View style={[s.catIconBox, isSelected ? s.catIconBoxActive : { backgroundColor: icon.bg }]}>
                    <Ionicons name={icon.name as any} size={16} color={isSelected ? T.navyDark : icon.color} />
                  </View>
                  <Text style={[s.catCardText, isSelected ? s.catCardTextActive : null]} numberOfLines={2}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Service & Order Form Section */}
          {selectedCategory && (
            <View style={s.formCard}>
              <View style={s.formHeaderRow}>
                <Text style={s.formHeading}>Boost Order Builder</Text>
                <View style={s.categoryTagPill}>
                  <Text style={s.categoryTagPillText}>{selectedCategory}</Text>
                </View>
              </View>
              
              <View style={s.fieldGroup}>
                <Text style={s.fieldLabel}>1. Select Package Type</Text>
                <TouchableOpacity 
                  onPress={() => setServiceModal(true)}
                  style={s.selectBtn}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[s.selectBtnText, selectedService ? s.selectBtnTextFilled : null]} numberOfLines={2}>
                      {selectedService ? selectedService.name : "Choose a boost package..."}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down-circle" size={18} color={T.gold} />
                </TouchableOpacity>
              </View>

              {selectedService && (
                <>
                  <View style={s.rateInfoBox}>
                    <View>
                      <Text style={s.rateInfoLabel}>Rate per 1,000</Text>
                      <Text style={s.rateInfoValue}>₦{parseFloat(selectedService.rate).toLocaleString()}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={s.rateInfoSubLabel}>Min / Max Limits</Text>
                      <Text style={s.rateInfoSubValue}>{selectedService.min} - {selectedService.max} • ⚡ Instant</Text>
                    </View>
                  </View>

                  <View style={s.fieldGroup}>
                    <View style={s.fieldHeaderRow}>
                      <Text style={s.fieldLabel}>2. Target Link / Username</Text>
                      {linkDetector && (
                        <View style={s.detectedChip}>
                          <Ionicons name={linkDetector.icon as any} size={10} color={linkDetector.color} />
                          <Text style={s.detectedChipText}>{linkDetector.platform} Detected</Text>
                        </View>
                      )}
                    </View>

                    <View style={s.inputWithBtnContainer}>
                      <TextInput
                        style={s.inputWithBtn}
                        placeholder={linkDetector ? `e.g. ${linkDetector.example}` : "Paste link e.g. https://instagram.com/p/..."}
                        placeholderTextColor={T.textSub}
                        value={link}
                        onChangeText={setLink}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <TouchableOpacity 
                        onPress={pasteFromClipboard}
                        activeOpacity={0.7}
                        style={s.pasteBtn}
                      >
                        <Ionicons name="clipboard-outline" size={12} color={T.navyDark} />
                        <Text style={s.pasteBtnText}>Paste</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={s.fieldGroup}>
                    <Text style={s.fieldLabel}>3. Select Quantity</Text>
                    <TextInput
                      style={s.standardInput}
                      placeholder={`Min: ${selectedService.min} • Max: ${selectedService.max}`}
                      placeholderTextColor={T.textSub}
                      value={quantity}
                      onChangeText={setQuantity}
                      keyboardType="numeric"
                    />
                    
                    {/* Quick Quantity Selector Chips */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.qtyChipsRow}>
                      {['100', '500', '1000', '2500', '5000', '10000', '25000', '50000'].map((val) => (
                        <TouchableOpacity
                          key={val}
                          onPress={() => setQuantity(val)}
                          activeOpacity={0.7}
                          style={[s.qtyChip, quantity === val ? s.qtyChipActive : null]}
                        >
                          <Text style={[s.qtyChipText, quantity === val ? { color: T.navyDark } : null]}>+{parseInt(val).toLocaleString()}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  {/* Executive Dark Navy & Gold Summary Breakdown */}
                  <View style={s.summaryCard}>
                    <View style={s.summaryHeaderRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="receipt" size={14} color={T.gold} />
                        <Text style={s.summaryHeadingText}>Order Summary</Text>
                      </View>
                      <View style={s.deliveryBadge}>
                        <Text style={s.deliveryBadgeText}>⚡ 2-15 Mins Start</Text>
                      </View>
                    </View>

                    <View style={s.summaryItemRow}>
                      <Text style={s.summaryItemLabel}>Service Rate (per 1k)</Text>
                      <Text style={s.summaryItemValue}>₦{parseFloat(selectedService.rate).toLocaleString()}</Text>
                    </View>

                    <View style={s.summaryItemRow}>
                      <Text style={s.summaryItemLabel}>Target Quantity</Text>
                      <Text style={s.summaryItemValue}>{quantity ? parseInt(quantity).toLocaleString() : '0'}</Text>
                    </View>

                    <View style={s.summaryTotalRow}>
                      <Text style={s.summaryTotalLabel}>Total Charge</Text>
                      <Text style={s.summaryTotalValue}>₦{totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                    </View>
                  </View>

                  {/* Wallet Balance Verification Banner */}
                  <View style={[
                    s.balanceCheckCard,
                    walletBalance >= totalPrice ? s.balanceCheckCardOk : s.balanceCheckCardLow
                  ]}>
                    <Ionicons 
                      name={walletBalance >= totalPrice ? "checkmark-circle" : "warning"} 
                      size={14} 
                      color={walletBalance >= totalPrice ? T.success : T.danger} 
                    />
                    <Text style={[
                      s.balanceCheckText,
                      walletBalance >= totalPrice ? { color: T.success } : { color: T.danger }
                    ]}>
                      {walletBalance >= totalPrice 
                        ? `Available Balance: ₦${walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                        : `Insufficient Balance (₦${walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })})`
                      }
                    </Text>
                    {walletBalance < totalPrice && (
                      <TouchableOpacity onPress={() => router.push('/(app)/wallet')} style={s.fundShortcutBtn}>
                        <Text style={s.fundShortcutBtnText}>Fund Wallet</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Glowing Gold Submit Button */}
                  <TouchableOpacity 
                    onPress={handleSubmit}
                    disabled={isSubmitting}
                    activeOpacity={0.85}
                    style={[s.submitBtn, isSubmitting ? { backgroundColor: T.navyCard } : null]}
                  >
                    {isSubmitting ? (
                      <View style={s.submittingRow}>
                        <ActivityIndicator size="small" color={T.navyDark} />
                        <Text style={s.submittingText}>Launching Order...</Text>
                      </View>
                    ) : (
                      <>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View style={s.submitIconBox}>
                            <Ionicons name="rocket" size={16} color={T.navyDark} />
                          </View>
                          <View>
                            <Text style={s.submitBtnTitle}>Submit Order Now</Text>
                            <Text style={s.submitBtnSub}>Instant Delivery • Safe & Refill Guaranteed</Text>
                          </View>
                        </View>
                        <View style={s.submitPricePill}>
                          <Text style={s.submitPricePillText}>₦{totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                        </View>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Service Selection Modal */}
      <Modal visible={serviceModal} animationType="slide" transparent={true}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            
            <View style={s.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={s.modalHeaderIconBox}>
                  <Ionicons name="sparkles" size={14} color={T.gold} />
                </View>
                <Text style={s.modalHeaderTitle}>Select Boost Package</Text>
              </View>
              <TouchableOpacity onPress={() => setServiceModal(false)} style={s.modalCloseBtn}>
                <Ionicons name="close" size={16} color={T.textSub} />
              </TouchableOpacity>
            </View>

            {/* Modal Search Bar */}
            <View style={s.modalSearchBox}>
              <Ionicons name="search" size={14} color={T.gold} />
              <TextInput 
                style={s.modalSearchInput}
                placeholder="Search packages (e.g. Real Followers, Likes, Views)..."
                placeholderTextColor={T.textSub}
                value={modalSearchQuery}
                onChangeText={setModalSearchQuery}
                autoCapitalize="none"
              />
              {modalSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setModalSearchQuery('')}>
                  <Ionicons name="close-circle" size={14} color={T.textSub} />
                </TouchableOpacity>
              )}
            </View>

            {selectedCategory && (
              <View style={s.categoryBadgePill}>
                <Text style={s.categoryBadgePillText}>{selectedCategory}</Text>
              </View>
            )}

            <FlatList 
              data={filteredServices}
              keyExtractor={(item, index) => item.service.toString() + index.toString()}
              initialNumToRender={15}
              maxToRenderPerBatch={10}
              windowSize={5}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 24 }}
              ListEmptyComponent={() => (
                <View style={s.emptyBox}>
                  <Ionicons name="search-outline" size={32} color={T.borderDark} />
                  <Text style={s.emptyText}>No matching services found</Text>
                </View>
              )}
              renderItem={({ item }) => {
                const isSelected = selectedService?.service === item.service;
                return (
                  <TouchableOpacity 
                    activeOpacity={0.8}
                    style={[s.serviceOptionItem, isSelected ? s.serviceOptionItemActive : null]}
                    onPress={() => {
                      setSelectedService(item);
                      setServiceModal(false);
                    }}
                  >
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={[s.serviceOptionName, isSelected ? { color: T.gold } : null]}>{item.name}</Text>
                      <View style={s.serviceOptionMetaRow}>
                        <View style={s.instantBadge}>
                          <Text style={s.instantBadgeText}>⚡ Instant</Text>
                        </View>
                        <Text style={[s.serviceOptionLimits, isSelected ? { color: '#CBD5E1' } : null]}>
                          Min: {item.min} • Max: {item.max}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={{ alignItems: 'flex-end' }}>
                      <View style={s.serviceRateTag}>
                        <Text style={s.serviceRateTagText}>₦{parseFloat(item.rate).toLocaleString()}</Text>
                      </View>
                      <Text style={[s.serviceRateSub, isSelected ? { color: T.gold } : null]}>
                        {isSelected ? '✓ Selected' : 'per 1,000'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* Order Confirmation Modal */}
      <Modal visible={confirmModal} animationType="fade" transparent={true}>
        <View style={s.modalOverlayCenter}>
          <View style={s.confirmModalCard}>
            <View style={{ alignItems: 'center', marginBottom: 14 }}>
              <View style={s.confirmHeaderIconBox}>
                <Ionicons name={linkDetector?.icon as any || "flash"} size={22} color={T.gold} />
              </View>
              <Text style={s.confirmModalTitle}>Confirm Social Boost</Text>
              <Text style={s.confirmModalSub}>Review your order details before launching</Text>
            </View>

            <View style={s.confirmReceiptCard}>
              <View style={{ marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: T.borderDark }}>
                <Text style={s.receiptItemLabel}>Selected Package</Text>
                <Text style={s.receiptItemValueTitle}>{selectedService?.name}</Text>
              </View>

              <View style={s.receiptRow}>
                <Text style={s.receiptLabel}>Target Link</Text>
                <Text style={s.receiptValText} numberOfLines={1}>{link}</Text>
              </View>

              <View style={s.receiptRow}>
                <Text style={s.receiptLabel}>Quantity</Text>
                <Text style={s.receiptValText}>{quantity ? parseInt(quantity).toLocaleString() : '0'}</Text>
              </View>

              <View style={s.receiptRow}>
                <Text style={s.receiptLabel}>Delivery Speed</Text>
                <Text style={s.speedText}>⚡ 2 - 15 Mins Start</Text>
              </View>

              <View style={s.receiptTotalRow}>
                <Text style={s.receiptTotalLabel}>Total Payable</Text>
                <Text style={s.receiptTotalVal}>₦{totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
              </View>
            </View>

            <View style={s.balanceCheckPill}>
              <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '600' }}>Wallet After Order:</Text>
              <Text style={{ color: T.textMain, fontSize: 11, fontWeight: '800' }}>₦{(walletBalance - totalPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
            </View>

            <View style={s.modalBtnRow}>
              <TouchableOpacity 
                onPress={() => setConfirmModal(false)}
                disabled={isSubmitting}
                style={s.cancelBtn}
              >
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={placeOrder}
                disabled={isSubmitting}
                activeOpacity={0.8}
                style={s.confirmSubmitBtn}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={T.navyDark} />
                ) : (
                  <>
                    <Ionicons name="rocket" size={14} color={T.navyDark} style={{ marginRight: 4 }} />
                    <Text style={s.confirmSubmitBtnText}>Confirm & Launch</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Decorated Alert Modal */}
      <Modal visible={alertModal.visible} animationType="fade" transparent={true}>
        <View style={s.modalOverlayCenter}>
          <View style={s.alertModalCard}>
            <View style={[
              s.alertIconBox,
              alertModal.type === 'success' ? { backgroundColor: T.successBg, borderColor: T.success } :
              alertModal.type === 'error' ? { backgroundColor: T.dangerBg, borderColor: T.danger } : { backgroundColor: T.goldLightBg, borderColor: T.gold }
            ]}>
              <Ionicons 
                name={
                  alertModal.type === 'success' ? 'checkmark-circle' :
                  alertModal.type === 'error' ? 'alert-circle' : 'information-circle'
                } 
                size={28} 
                color={
                  alertModal.type === 'success' ? T.success :
                  alertModal.type === 'error' ? T.danger : T.gold
                } 
              />
            </View>

            <Text style={s.alertModalTitle}>{alertModal.title}</Text>
            <Text style={s.alertModalMessage}>{alertModal.message}</Text>

            {alertModal.orderId && (
              <View style={s.orderIdBox}>
                <Text style={s.orderIdText}>Order ID: #{alertModal.orderId}</Text>
                <TouchableOpacity 
                  onPress={async () => {
                    if (alertModal.orderId) {
                      await Clipboard.setStringAsync(alertModal.orderId);
                      showAlert("Copied!", "Order ID copied to clipboard.", "success");
                    }
                  }}
                  style={s.copyBtn}
                >
                  <Ionicons name="copy-outline" size={11} color={T.gold} />
                  <Text style={s.copyBtnText}>Copy</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={s.alertBtnRow}>
              {alertModal.type === 'success' ? (
                <>
                  <TouchableOpacity 
                    onPress={() => setAlertModal(prev => ({ ...prev, visible: false }))}
                    style={s.alertCloseBtn}
                  >
                    <Text style={s.alertCloseBtnText}>Close</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    onPress={() => {
                      setAlertModal(prev => ({ ...prev, visible: false }));
                      router.push('/social-orders');
                    }}
                    style={s.alertViewOrdersBtn}
                  >
                    <Ionicons name="receipt" size={12} color={T.navyDark} style={{ marginRight: 3 }} />
                    <Text style={s.alertViewOrdersBtnText}>View Orders</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity 
                  onPress={() => setAlertModal(prev => ({ ...prev, visible: false }))}
                  style={s.alertOkBtn}
                >
                  <Text style={s.alertOkBtnText}>OK, Got It</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.navyDark,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: T.navyDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: T.gold,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 10,
  },
  header: {
    paddingHorizontal: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    borderBottomWidth: 1,
    borderBottomColor: T.borderGold,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: T.goldLightBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: T.borderGold,
  },
  headerTitleCol: {
    alignItems: 'center',
  },
  headerTitle: {
    color: T.textMain,
    fontWeight: '800',
    fontSize: 14,
  },
  balanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.goldLightBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 16,
    marginTop: 3,
    borderWidth: 1,
    borderColor: T.borderGold,
  },
  balanceChipText: {
    color: T.gold,
    fontSize: 10,
    fontWeight: '800',
    marginLeft: 3,
  },
  topFeatureBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(245, 158, 11, 0.15)',
  },
  topFeaturePill: {
    backgroundColor: 'rgba(11, 19, 43, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  topFeaturePillText: {
    fontSize: 8.5,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 100,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    marginTop: 6,
  },
  sectionLabel: {
    color: T.gold,
    fontSize: 9.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginLeft: 2,
  },
  clearCategoryText: {
    color: T.goldBright,
    fontSize: 10,
    fontWeight: '700',
  },
  filterRow: {
    marginBottom: 12,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 6,
    backgroundColor: T.navyCard,
    borderWidth: 1,
    borderColor: T.borderDark,
  },
  filterPillActive: {
    backgroundColor: T.gold,
    borderColor: T.goldBright,
  },
  filterPillText: {
    color: T.textSub,
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 5,
  },
  filterPillTextActive: {
    color: T.navyDark,
    fontWeight: '900',
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.navyCard,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: T.borderGold,
    marginBottom: 12,
  },
  searchBarInput: {
    flex: 1,
    fontSize: 11,
    color: T.textMain,
    fontWeight: '600',
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 16,
  },
  catCard: {
    width: (SCREEN_WIDTH - 52) / 4,
    aspectRatio: 1,
    backgroundColor: T.navyCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.borderDark,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  catCardActive: {
    backgroundColor: T.navyCard,
    borderColor: T.gold,
    borderWidth: 1.5,
  },
  catIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  catIconBoxActive: {
    backgroundColor: T.gold,
  },
  catCardText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: T.textSub,
    textAlign: 'center',
    lineHeight: 11,
  },
  catCardTextActive: {
    color: T.gold,
    fontWeight: '900',
  },
  formCard: {
    backgroundColor: T.navyCard,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: T.borderGold,
    shadowColor: T.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
    marginBottom: 20,
  },
  formHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  formHeading: {
    fontSize: 11,
    fontWeight: '900',
    color: T.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  categoryTagPill: {
    backgroundColor: T.goldLightBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: T.borderGold,
  },
  categoryTagPillText: {
    color: T.gold,
    fontSize: 9,
    fontWeight: '800',
  },
  fieldGroup: {
    marginBottom: 12,
  },
  fieldHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: T.textSub,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  selectBtn: {
    backgroundColor: T.navySubCard,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: T.borderDark,
  },
  selectBtnText: {
    fontSize: 11,
    color: T.textSub,
    fontWeight: '600',
  },
  selectBtnTextFilled: {
    color: T.textMain,
    fontWeight: '800',
  },
  rateInfoBox: {
    backgroundColor: T.goldLightBg,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.borderGold,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rateInfoLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: T.gold,
  },
  rateInfoValue: {
    fontSize: 13,
    fontWeight: '900',
    color: T.textMain,
    marginTop: 1,
  },
  rateInfoSubLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: T.goldBright,
  },
  rateInfoSubValue: {
    fontSize: 9.5,
    fontWeight: '800',
    color: T.textMain,
    marginTop: 1,
  },
  detectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.successBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: T.success,
  },
  detectedChipText: {
    color: T.success,
    fontSize: 8.5,
    fontWeight: '800',
    marginLeft: 3,
  },
  inputWithBtnContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.navySubCard,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: T.borderDark,
  },
  inputWithBtn: {
    flex: 1,
    paddingVertical: 6,
    fontSize: 11,
    color: T.textMain,
    fontWeight: '600',
  },
  pasteBtn: {
    backgroundColor: T.gold,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pasteBtnText: {
    color: T.navyDark,
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginLeft: 3,
  },
  standardInput: {
    backgroundColor: T.navySubCard,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 11,
    color: T.textMain,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: T.borderDark,
  },
  qtyChipsRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  qtyChip: {
    backgroundColor: T.navySubCard,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginRight: 5,
    borderWidth: 1,
    borderColor: T.borderDark,
  },
  qtyChipActive: {
    backgroundColor: T.gold,
    borderColor: T.goldBright,
  },
  qtyChipText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: T.textSub,
  },
  summaryCard: {
    backgroundColor: T.navySubCard,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: T.borderGold,
    marginBottom: 10,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: T.borderDark,
    marginBottom: 8,
  },
  summaryHeadingText: {
    color: T.gold,
    fontSize: 9.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginLeft: 5,
  },
  deliveryBadge: {
    backgroundColor: T.goldLightBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: T.borderGold,
  },
  deliveryBadgeText: {
    color: T.gold,
    fontSize: 8.5,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  summaryItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  summaryItemLabel: {
    color: T.textSub,
    fontSize: 10,
    fontWeight: '600',
  },
  summaryItemValue: {
    color: T.textMain,
    fontSize: 10,
    fontWeight: '800',
  },
  summaryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: T.borderDark,
    marginTop: 4,
  },
  summaryTotalLabel: {
    color: T.textMain,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  summaryTotalValue: {
    color: T.gold,
    fontSize: 16,
    fontWeight: '900',
  },
  balanceCheckCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  balanceCheckCardOk: {
    backgroundColor: T.successBg,
    borderColor: T.success,
  },
  balanceCheckCardLow: {
    backgroundColor: T.dangerBg,
    borderColor: T.danger,
  },
  balanceCheckText: {
    fontSize: 10,
    fontWeight: '800',
    flex: 1,
    marginLeft: 5,
  },
  fundShortcutBtn: {
    backgroundColor: T.danger,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  fundShortcutBtnText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  submitBtn: {
    backgroundColor: T.gold,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: T.goldBright,
    shadowColor: T.gold,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  submittingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  submittingText: {
    color: T.navyDark,
    fontSize: 11,
    fontWeight: '900',
    marginLeft: 6,
    textTransform: 'uppercase',
  },
  submitIconBox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(11, 19, 43, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  submitBtnTitle: {
    color: T.navyDark,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  submitBtnSub: {
    color: '#334155',
    fontSize: 8.5,
    fontWeight: '700',
  },
  submitPricePill: {
    backgroundColor: T.navyDark,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  submitPricePillText: {
    color: T.gold,
    fontSize: 11,
    fontWeight: '900',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 19, 43, 0.85)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: T.navyCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    maxHeight: '82%',
    borderWidth: 1,
    borderColor: T.borderGold,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: T.borderDark,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalHeaderIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: T.goldLightBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  modalHeaderTitle: {
    color: T.textMain,
    fontSize: 14,
    fontWeight: '900',
  },
  modalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: T.navySubCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.navySubCard,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: T.borderGold,
    marginBottom: 10,
  },
  modalSearchInput: {
    flex: 1,
    marginLeft: 6,
    fontSize: 11,
    color: T.textMain,
    fontWeight: '600',
  },
  categoryBadgePill: {
    alignSelf: 'flex-start',
    backgroundColor: T.goldLightBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: T.borderGold,
  },
  categoryBadgePillText: {
    color: T.gold,
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  emptyBox: {
    paddingVertical: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: T.textSub,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
  serviceOptionItem: {
    backgroundColor: T.navySubCard,
    borderRadius: 12,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: T.borderDark,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  serviceOptionItemActive: {
    backgroundColor: T.navySubCard,
    borderColor: T.gold,
    borderWidth: 1.5,
  },
  serviceOptionName: {
    fontSize: 11,
    fontWeight: '800',
    color: T.textMain,
    lineHeight: 16,
  },
  serviceOptionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  instantBadge: {
    backgroundColor: T.successBg,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: T.success,
  },
  instantBadgeText: {
    color: T.success,
    fontSize: 8.5,
    fontWeight: '800',
  },
  serviceOptionLimits: {
    fontSize: 9,
    fontWeight: '600',
    color: T.textSub,
  },
  serviceRateTag: {
    backgroundColor: T.goldLightBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: T.borderGold,
  },
  serviceRateTagText: {
    color: T.gold,
    fontSize: 11,
    fontWeight: '900',
  },
  serviceRateSub: {
    fontSize: 7.5,
    fontWeight: '800',
    color: T.textSub,
    textTransform: 'uppercase',
    marginTop: 3,
  },
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(11, 19, 43, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  confirmModalCard: {
    backgroundColor: T.navyCard,
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: T.borderGold,
    shadowColor: T.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  confirmHeaderIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: T.goldLightBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: T.borderGold,
  },
  confirmModalTitle: {
    color: T.textMain,
    fontSize: 15,
    fontWeight: '900',
  },
  confirmModalSub: {
    color: T.textSub,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
  },
  confirmReceiptCard: {
    backgroundColor: T.navySubCard,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.borderDark,
    marginBottom: 12,
  },
  receiptItemLabel: {
    color: T.textSub,
    fontSize: 8.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  receiptItemValueTitle: {
    color: T.textMain,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 16,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  receiptLabel: {
    color: T.textSub,
    fontSize: 10,
    fontWeight: '600',
  },
  receiptValText: {
    color: T.textMain,
    fontSize: 10,
    fontWeight: '800',
    maxWidth: 150,
  },
  speedText: {
    color: T.success,
    fontSize: 10,
    fontWeight: '800',
  },
  receiptTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: T.borderDark,
    marginTop: 4,
  },
  receiptTotalLabel: {
    color: T.textMain,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  receiptTotalVal: {
    color: T.gold,
    fontSize: 15,
    fontWeight: '900',
  },
  balanceCheckPill: {
    backgroundColor: T.navySubCard,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: T.borderDark,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: T.navySubCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: T.borderDark,
  },
  cancelBtnText: {
    color: T.textSub,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  confirmSubmitBtn: {
    flex: 2,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: T.gold,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  confirmSubmitBtnText: {
    color: T.navyDark,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  alertModalCard: {
    backgroundColor: T.navyCard,
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: T.borderGold,
    alignItems: 'center',
  },
  alertIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1,
  },
  alertModalTitle: {
    color: T.textMain,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 4,
  },
  alertModalMessage: {
    color: T.textSub,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 16,
  },
  orderIdBox: {
    backgroundColor: T.navySubCard,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: T.borderDark,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 14,
  },
  orderIdText: {
    color: T.textSub,
    fontSize: 10,
    fontWeight: '700',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.goldLightBg,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: T.borderGold,
  },
  copyBtnText: {
    color: T.gold,
    fontSize: 8.5,
    fontWeight: '800',
    marginLeft: 2,
  },
  alertBtnRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  alertCloseBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: T.navySubCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: T.borderDark,
  },
  alertCloseBtnText: {
    color: T.textSub,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  alertViewOrdersBtn: {
    flex: 1.5,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: T.gold,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  alertViewOrdersBtnText: {
    color: T.navyDark,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  alertOkBtn: {
    width: '100%',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: T.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertOkBtnText: {
    color: T.navyDark,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
});
