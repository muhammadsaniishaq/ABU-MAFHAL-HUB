import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, Image, Switch, ActivityIndicator,
  Modal, TextInput, Alert, ScrollView, StyleSheet, Platform, Dimensions, StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../services/supabase';

// Platinum Light Executive Theme Tokens
const L = {
  bg: '#F4F6FB',
  card: '#FFFFFF',
  cardBorder: '#E2E8F0',
  navyHeader: '#0F172A',
  navyMid: '#1E293B',
  gold: '#FFD700',
  goldDk: '#DAA520',
  goldAmber: '#D97706',
  goldLight: '#FEF3C7',
  textPrimary: '#0F172A',
  textSecondary: '#334155',
  textMuted: '#64748B',
  emerald: '#10B981',
  emeraldBg: '#ECFDF5',
  emeraldBorder: '#A7F3D0',
  sky: '#0EA5E9',
  skyBg: '#F0F9FF',
  coral: '#EF4444',
  coralBg: '#FFF1F2',
  coralBorder: '#FECDD3',
};

const AVAILABLE_PLACEMENTS = [
  'dashboard', 'airtime', 'data', 'bills', 'transfer',
  'education', 'smile', 'cac', 'nin_bvn', 'social_boost', 'crypto', 'qr_pay', 'wallet', 'services'
];

export default function ModernContentManager() {
  const router = useRouter();
  const [banners, setBanners] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Banner modal state
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTargetUrl, setNewTargetUrl] = useState('');
  const [newPlacements, setNewPlacements] = useState<string[]>(['dashboard']);
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);

  // Partner modal state
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [newPartnerName, setNewPartnerName] = useState('');
  const [newPartnerLogo, setNewPartnerLogo] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [editingPartnerId, setEditingPartnerId] = useState<string | null>(null);
  const [existingPartnerLogoUrl, setExistingPartnerLogoUrl] = useState<string | null>(null);

  // Active tab & announcement state
  const [activeTab, setActiveTab] = useState<'banners' | 'partners' | 'announcements' | 'settings'>('banners');
  const [announcementText, setAnnouncementText] = useState('');
  const [announcementUrl, setAnnouncementUrl] = useState('');
  const [announcementType, setAnnouncementType] = useState<'image' | 'video'>('image');
  const [announcementActive, setAnnouncementActive] = useState(false);
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [uploadingAnnouncement, setUploadingAnnouncement] = useState(false);

  // System settings
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    fetchBanners();
    fetchPartners();
    fetchAnnouncement();
  }, []);

  const fetchPartners = async () => {
    try {
      const { data } = await supabase.from('partners').select('*').order('sort_order', { ascending: true });
      if (data) setPartners(data);
    } catch (e) {}
  };

  const fetchAnnouncement = async () => {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['global_announcement', 'maintenance_mode']);
      if (data) {
        data.forEach(setting => {
          if (setting.key === 'global_announcement' && setting.value) {
            try {
              const parsed = typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value;
              setAnnouncementText(parsed.text || '');
              setAnnouncementUrl(parsed.mediaUrl || '');
              setAnnouncementType(parsed.mediaType || 'image');
              setAnnouncementActive(!!parsed.isActive);
            } catch (e) {}
          }
          if (setting.key === 'maintenance_mode') {
            setMaintenanceMode(setting.value === 'true' || setting.value === true);
          }
        });
      }
    } catch (e) {}
  };

  const fetchBanners = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('banners').select('*').order('created_at', { ascending: false });
      if (data) setBanners(data);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted' && Platform.OS !== 'web') {
        Alert.alert("Permission Required", "Please grant photo library access.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true, // Forces cropping / resizing to uniform 2.5:1 banner dimensions
        aspect: [5, 2], // 2.5:1 aspect ratio (e.g. 1200x480) for 100% uniform banners across all screens
        quality: 0.9,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(result.assets[0]);
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to pick image");
    }
  };

  const pickPartnerLogo = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted' && Platform.OS !== 'web') {
        Alert.alert("Permission Required", "Please grant photo library access.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setNewPartnerLogo(result.assets[0]);
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to pick logo");
    }
  };

  const pickAnnouncementMedia = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted' && Platform.OS !== 'web') {
        return Alert.alert("Permission Required", "Please allow gallery access.");
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.85,
        base64: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        setUploadingAnnouncement(true);

        const isVideo = asset.type === 'video';
        const fileExt = (asset.uri.split('.').pop() || (isVideo ? 'mp4' : 'jpg')).split('?')[0];
        const fileName = `announcement_${Date.now()}.${fileExt}`;
        const mimeType = isVideo ? 'video/mp4' : 'image/jpeg';

        let publicUrl = asset.base64 ? `data:${mimeType};base64,${asset.base64}` : asset.uri;

        if (asset.base64) {
          try {
            const { error: uploadErr } = await supabase.storage
              .from('banners')
              .upload(`announcements/${fileName}`, decode(asset.base64), {
                contentType: mimeType,
                upsert: true
              });

            if (!uploadErr) {
              const { data: publicUrlData } = supabase.storage
                .from('banners')
                .getPublicUrl(`announcements/${fileName}`);
              if (publicUrlData?.publicUrl) publicUrl = publicUrlData.publicUrl;
            }
          } catch (storageErr) {
            console.warn("Announcement storage upload fallback:", storageErr);
          }
        }

        setAnnouncementType(isVideo ? 'video' : 'image');
        setAnnouncementUrl(publicUrl);
        Alert.alert("Media Ready 🎉", "Announcement media attached successfully!");
      }
    } catch (err: any) {
      Alert.alert("Media Error", err.message || "Failed to select media");
    } finally {
      setUploadingAnnouncement(false);
    }
  };

  const saveBanner = async () => {
    if (!selectedImage && !existingImageUrl) return Alert.alert("Required", "Please select a banner image");

    setUploading(true);
    try {
      let publicUrl = existingImageUrl;

      if (selectedImage) {
        const fileExt = (selectedImage.uri.split('.').pop() || 'jpg').split('?')[0];
        const fileName = `banner_${Date.now()}.${fileExt}`;
        const mimeType = fileExt.toLowerCase() === 'png' ? 'image/png' : 'image/jpeg';

        publicUrl = selectedImage.base64 ? `data:${mimeType};base64,${selectedImage.base64}` : selectedImage.uri;

        if (selectedImage.base64) {
          try {
            const { error: uploadError } = await supabase.storage
              .from('banners')
              .upload(fileName, decode(selectedImage.base64), { contentType: mimeType, upsert: true });

            if (!uploadError) {
              const { data: urlData } = supabase.storage.from('banners').getPublicUrl(fileName);
              if (urlData?.publicUrl) publicUrl = urlData.publicUrl;
            }
          } catch (storageErr) {
            console.warn("Banner storage upload fallback:", storageErr);
          }
        }
      }

      if (editingBannerId) {
        const { error } = await supabase
          .from('banners')
          .update({
            title: newTitle.trim(),
            image_url: publicUrl,
            target_url: newTargetUrl.trim(),
            placement: newPlacements.join(',')
          })
          .eq('id', editingBannerId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('banners')
          .insert({
            title: newTitle.trim(),
            image_url: publicUrl,
            target_url: newTargetUrl.trim(),
            placement: newPlacements.join(','),
            is_active: true
          });
        if (error) throw error;
      }

      fetchBanners();
      closeModal();
      Alert.alert("Success 🎉", "Banner saved successfully!");
    } catch (err: any) {
      Alert.alert("Failed", err.message);
    } finally {
      setUploading(false);
    }
  };

  const savePartner = async () => {
    if (!newPartnerName.trim()) return Alert.alert("Required", "Please enter partner name");
    if (!newPartnerLogo && !existingPartnerLogoUrl) return Alert.alert("Required", "Please select a partner logo");

    setUploading(true);
    try {
      let logoUrl = existingPartnerLogoUrl;

      if (newPartnerLogo) {
        const fileExt = (newPartnerLogo.uri.split('.').pop() || 'png').split('?')[0];
        const fileName = `partner_${Date.now()}.${fileExt}`;
        const mimeType = fileExt.toLowerCase() === 'png' ? 'image/png' : 'image/jpeg';

        logoUrl = newPartnerLogo.base64 ? `data:${mimeType};base64,${newPartnerLogo.base64}` : newPartnerLogo.uri;

        if (newPartnerLogo.base64) {
          try {
            const { error: uploadError } = await supabase.storage
              .from('partners')
              .upload(fileName, decode(newPartnerLogo.base64), { contentType: mimeType, upsert: true });

            if (!uploadError) {
              const { data: publicUrlData } = supabase.storage.from('partners').getPublicUrl(fileName);
              if (publicUrlData?.publicUrl) logoUrl = publicUrlData.publicUrl;
            }
          } catch (storageErr) {
            console.warn("Partner logo storage upload fallback:", storageErr);
          }
        }
      }

      if (editingPartnerId) {
        const { error } = await supabase
          .from('partners')
          .update({
            name: newPartnerName.trim(),
            logo_url: logoUrl,
          })
          .eq('id', editingPartnerId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('partners')
          .insert({
            name: newPartnerName.trim(),
            logo_url: logoUrl,
            sort_order: partners.length + 1,
            is_active: true
          });
        if (error) throw error;
      }

      fetchPartners();
      closePartnerModal();
      Alert.alert("Success 🎉", "Partner saved successfully!");
    } catch (err: any) {
      Alert.alert("Failed", err.message);
    } finally {
      setUploading(false);
    }
  };

  const openEditBannerModal = (banner: any) => {
    setEditingBannerId(banner.id);
    setNewTitle(banner.title || '');
    setNewTargetUrl(banner.target_url || '');
    setNewPlacements(banner.placement ? banner.placement.split(',') : ['dashboard']);
    setExistingImageUrl(banner.image_url);
    setSelectedImage(null);
    setShowModal(true);
  };

  const openEditPartnerModal = (partner: any) => {
    setEditingPartnerId(partner.id);
    setNewPartnerName(partner.name);
    setExistingPartnerLogoUrl(partner.logo_url);
    setNewPartnerLogo(null);
    setShowPartnerModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingBannerId(null);
    setNewTitle('');
    setNewTargetUrl('');
    setNewPlacements(['dashboard']);
    setSelectedImage(null);
    setExistingImageUrl(null);
  };

  const closePartnerModal = () => {
    setShowPartnerModal(false);
    setEditingPartnerId(null);
    setNewPartnerName('');
    setNewPartnerLogo(null);
    setExistingPartnerLogoUrl(null);
  };

  const togglePlacement = (placement: string) => {
    if (newPlacements.includes(placement)) {
      if (newPlacements.length > 1) {
        setNewPlacements(newPlacements.filter(p => p !== placement));
      } else {
        Alert.alert("Notice", "Banner must have at least one placement destination.");
      }
    } else {
      setNewPlacements([...newPlacements, placement]);
    }
  };

  const toggleSelectAllPlacements = () => {
    if (newPlacements.length === AVAILABLE_PLACEMENTS.length) {
      setNewPlacements(['dashboard']);
    } else {
      setNewPlacements([...AVAILABLE_PLACEMENTS]);
    }
  };

  const toggleBanner = async (id: string, currentStatus: boolean) => {
    try {
      await supabase.from('banners').update({ is_active: !currentStatus }).eq('id', id);
      fetchBanners();
    } catch (e) {}
  };

  const deleteBanner = async (id: string) => {
    Alert.alert("Delete Banner", "Are you sure you want to permanently delete this banner?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await supabase.from('banners').delete().eq('id', id);
          fetchBanners();
        }
      }
    ]);
  };

  const deletePartner = async (id: string) => {
    Alert.alert("Delete Partner", "Are you sure you want to delete this partner brand?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await supabase.from('partners').delete().eq('id', id);
          fetchPartners();
        }
      }
    ]);
  };

  const saveAnnouncement = async () => {
    setSavingAnnouncement(true);
    try {
      await supabase.from('app_settings').upsert({
        key: 'global_announcement',
        value: {
          text: announcementText,
          mediaUrl: announcementUrl,
          mediaType: announcementType,
          isActive: announcementActive
        },
        description: 'Global Popup Announcement'
      }, { onConflict: 'key' });
      Alert.alert("Success 🎉", "Global Announcement published successfully!");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSavingAnnouncement(false);
    }
  };

  const toggleMaintenanceMode = async (value: boolean) => {
    setMaintenanceMode(value);
    setSavingSettings(true);
    try {
      await supabase.from('app_settings').upsert({
        key: 'maintenance_mode',
        value: String(value),
        description: 'Put app in maintenance mode'
      }, { onConflict: 'key' });
      Alert.alert("Notice", `Maintenance mode is now ${value ? 'ACTIVATED' : 'DEACTIVATED'}`);
    } catch (e) {} finally {
      setSavingSettings(false);
    }
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <Stack.Screen options={{ headerShown: false }} />

      {/* EXECUTIVE TOP BAR */}
      <View style={s.topBar}>
        <View style={s.topBarRow}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.75}>
            <Ionicons name="arrow-back" size={16} color={L.gold} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={s.topBarTitle}>Content & Brand Manager</Text>
            <Text style={s.topBarSub}>Manage banners, partnerships, announcements, and app alerts</Text>
          </View>
          {activeTab === 'banners' ? (
            <TouchableOpacity onPress={() => setShowModal(true)} style={s.addBtn} activeOpacity={0.8}>
              <Ionicons name="add" size={15} color="#0F172A" />
              <Text style={s.addBtnText}>New Banner</Text>
            </TouchableOpacity>
          ) : activeTab === 'partners' ? (
            <TouchableOpacity onPress={() => setShowPartnerModal(true)} style={s.addBtn} activeOpacity={0.8}>
              <Ionicons name="add" size={15} color="#0F172A" />
              <Text style={s.addBtnText}>New Partner</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* CUSTOM SEGMENTED TAB BAR */}
        <View style={s.tabBarRow}>
          {[
            { id: 'banners', label: 'Banners', icon: 'images-outline' },
            { id: 'partners', label: 'Partners', icon: 'briefcase-outline' },
            { id: 'announcements', label: 'Popup Alert', icon: 'megaphone-outline' },
            { id: 'settings', label: 'System', icon: 'construct-outline' }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id as any)}
                style={[s.tabPill, isActive && s.tabPillActive]}
                activeOpacity={0.75}
              >
                <Ionicons name={tab.icon as any} size={11} color={isActive ? '#0F172A' : L.goldLight} />
                <Text style={[s.tabPillText, isActive && s.tabPillTextActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* BODY CONTENT */}
      {loading ? (
        <View style={s.centerBox}>
          <ActivityIndicator size="small" color={L.goldDk} />
          <Text style={s.loadingText}>Loading content assets...</Text>
        </View>
      ) : (
        <ScrollView style={s.scrollArea} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          {/* TAB 1: BANNERS */}
          {activeTab === 'banners' && (
            <View>
              {banners.length === 0 ? (
                <View style={s.emptyBox}>
                  <Ionicons name="images-outline" size={28} color={L.goldDk} />
                  <Text style={s.emptyTitle}>No Promo Banners Active</Text>
                  <Text style={s.emptySub}>Tap "New Banner" above to create promotions and app sliders.</Text>
                </View>
              ) : (
                banners.map(b => (
                  <View key={b.id} style={s.card}>
                    <Image source={{ uri: b.image_url }} style={s.bannerImagePreview} resizeMode="cover" />
                    <View style={s.cardBody}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={s.cardTitle}>{b.title || 'Untitled Banner'}</Text>
                          {b.target_url ? <Text style={s.cardUrl} numberOfLines={1}>{b.target_url}</Text> : null}
                        </View>
                        <Switch
                          value={b.is_active}
                          onValueChange={() => toggleBanner(b.id, b.is_active)}
                          trackColor={{ false: '#CBD5E1', true: L.emerald }}
                          thumbColor="#FFFFFF"
                          style={{ transform: [{ scale: 0.75 }] }}
                        />
                      </View>

                      {/* Placements */}
                      <View style={s.placementsRow}>
                        {(b.placement ? b.placement.split(',') : ['dashboard']).map((p: string) => (
                          <View key={p} style={s.placementBadge}>
                            <Text style={s.placementBadgeText}>{p.toUpperCase()}</Text>
                          </View>
                        ))}
                      </View>

                      {/* Actions */}
                      <View style={s.cardFooter}>
                        <TouchableOpacity onPress={() => openEditBannerModal(b)} style={s.actionBtn}>
                          <Ionicons name="pencil" size={11} color={L.navyHeader} />
                          <Text style={s.actionBtnText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => deleteBanner(b.id)} style={[s.actionBtn, { borderColor: L.coralBorder, backgroundColor: L.coralBg }]}>
                          <Ionicons name="trash-outline" size={11} color={L.coral} />
                          <Text style={[s.actionBtnText, { color: L.coral }]}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {/* TAB 2: PARTNERS */}
          {activeTab === 'partners' && (
            <View>
              {partners.length === 0 ? (
                <View style={s.emptyBox}>
                  <Ionicons name="briefcase-outline" size={28} color={L.goldDk} />
                  <Text style={s.emptyTitle}>No Partners Listed</Text>
                  <Text style={s.emptySub}>Add network providers, payment gateways, and banking partners.</Text>
                </View>
              ) : (
                partners.map(p => (
                  <View key={p.id} style={s.partnerCard}>
                    <Image source={{ uri: p.logo_url }} style={s.partnerLogo} resizeMode="contain" />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={s.partnerName}>{p.name}</Text>
                      <Text style={s.partnerSub}>Sort Order: {p.sort_order || 1}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity onPress={() => openEditPartnerModal(p)} style={s.iconBtn}>
                        <Ionicons name="pencil" size={12} color={L.navyHeader} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => deletePartner(p.id)} style={[s.iconBtn, { backgroundColor: L.coralBg, borderColor: L.coralBorder }]}>
                        <Ionicons name="trash-outline" size={12} color={L.coral} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {/* TAB 3: ANNOUNCEMENT */}
          {activeTab === 'announcements' && (
            <View style={s.announcementCard}>
              <View style={s.announcementHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="megaphone" size={14} color={L.goldAmber} />
                  <Text style={s.announcementTitle}>Global User Announcement</Text>
                </View>
                <Switch
                  value={announcementActive}
                  onValueChange={setAnnouncementActive}
                  trackColor={{ false: '#CBD5E1', true: L.emerald }}
                  thumbColor="#FFFFFF"
                  style={{ transform: [{ scale: 0.8 }] }}
                />
              </View>

              <Text style={s.inputLabel}>Announcement Headline / Message</Text>
              <TextInput
                placeholder="Important service update or promo message..."
                placeholderTextColor="#94A3B8"
                style={s.textArea}
                value={announcementText}
                onChangeText={setAnnouncementText}
                multiline
              />

              <Text style={s.inputLabel}>Attached Media (Optional Image / Video)</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                <TouchableOpacity onPress={pickAnnouncementMedia} style={s.mediaPickBtn} activeOpacity={0.8}>
                  <Ionicons name="cloud-upload-outline" size={14} color={L.navyHeader} />
                  <Text style={s.mediaPickBtnText}>Select Media from Gallery</Text>
                </TouchableOpacity>
                {announcementUrl ? (
                  <TouchableOpacity onPress={() => setAnnouncementUrl('')} style={s.mediaClearBtn}>
                    <Ionicons name="close" size={14} color={L.coral} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {announcementUrl ? (
                <View style={s.announcementPreviewBox}>
                  <Image source={{ uri: announcementUrl }} style={s.announcementPreviewImg} resizeMode="cover" />
                  <Text style={s.announcementTypeTag}>{announcementType.toUpperCase()}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                onPress={saveAnnouncement}
                disabled={savingAnnouncement}
                style={s.saveMainBtn}
                activeOpacity={0.85}
              >
                <LinearGradient colors={['#0F172A', '#1E293B']} style={s.saveMainGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  {savingAnnouncement ? (
                    <ActivityIndicator size="small" color={L.gold} />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={14} color={L.gold} />
                      <Text style={s.saveMainText}>Publish Announcement</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {/* TAB 4: SYSTEM */}
          {activeTab === 'settings' && (
            <View style={s.settingsCard}>
              <View style={s.systemSettingRow}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="construct" size={14} color={L.coral} />
                    <Text style={s.settingTitle}>Maintenance Mode</Text>
                  </View>
                  <Text style={s.settingDesc}>
                    When active, non-admin users will see a maintenance screen and cannot make transactions.
                  </Text>
                </View>
                <Switch
                  value={maintenanceMode}
                  onValueChange={toggleMaintenanceMode}
                  trackColor={{ false: '#CBD5E1', true: L.coral }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* BANNER CREATE / EDIT MODAL */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{editingBannerId ? 'Edit Promo Banner' : 'Create New Banner'}</Text>
              <TouchableOpacity onPress={closeModal} style={s.modalCloseBtn}>
                <Ionicons name="close" size={16} color={L.navyHeader} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Image Preview & Picker */}
              <TouchableOpacity onPress={pickImage} style={s.imagePickerBox} activeOpacity={0.8}>
                {selectedImage ? (
                  <Image source={{ uri: selectedImage.uri }} style={s.modalImagePreview} resizeMode="cover" />
                ) : existingImageUrl ? (
                  <Image source={{ uri: existingImageUrl }} style={s.modalImagePreview} resizeMode="cover" />
                ) : (
                  <View style={s.imagePickerPlaceholder}>
                    <Ionicons name="image-outline" size={26} color={L.goldDk} />
                    <Text style={s.imagePickerText}>Danna Nan Don Ɗora Banner (Tap to Upload)</Text>
                    <Text style={{ fontSize: 9, color: L.textMuted }}>Aspect Ratio: 2.5 : 1 (1200 x 480 px)</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* RECOMMENDED UNIFORM BANNER DIMENSIONS SUGGESTION CARD */}
              <View style={{ marginTop: 2, marginBottom: 12, backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#F59E0B', borderRadius: 12, padding: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <Ionicons name="sparkles" size={14} color="#D97706" />
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#B45309', textTransform: 'uppercase' }}>
                    Shawarar Ma'aunin Banner (Recommended Dimensions)
                  </Text>
                </View>
                <Text style={{ fontSize: 10.5, color: '#78350F', lineHeight: 15, fontWeight: '500' }}>
                  • <Text style={{ fontWeight: '700' }}>Standard Resolution:</Text> 1200 x 480 px (ko 1080 x 430 px){'\n'}
                  • <Text style={{ fontWeight: '700' }}>Aspect Ratio:</Text> 2.5 : 1 (Uniform Banner Ratio){'\n'}
                  • <Text style={{ fontWeight: '700' }}>Tilasta Resize/Crop:</Text> Idan ka zaɓi hoto, tsarin zai nuna maka wajen saita (crop) shi a kan daidai ma'aunin 2.5:1 domin kowane banner ya fita daidai cif ba tare da wani ya fi wani tsayi ba!
                </Text>
              </View>

              <Text style={s.inputLabel}>Banner Title</Text>
              <TextInput
                placeholder="e.g. 50% Airtime Discount Promo"
                placeholderTextColor="#94A3B8"
                style={s.modalInput}
                value={newTitle}
                onChangeText={setNewTitle}
              />

              <Text style={s.inputLabel}>Target Route / Web Link (Optional)</Text>
              <TextInput
                placeholder="e.g. /airtime or https://..."
                placeholderTextColor="#94A3B8"
                style={s.modalInput}
                value={newTargetUrl}
                onChangeText={setNewTargetUrl}
              />

              {/* Placement Selector */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, marginBottom: 4 }}>
                <Text style={s.inputLabel}>Show On Screens</Text>
                <TouchableOpacity onPress={toggleSelectAllPlacements}>
                  <Text style={s.selectAllText}>
                    {newPlacements.length === AVAILABLE_PLACEMENTS.length ? 'Clear All' : 'Select All'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={s.placementSelectorRow}>
                {AVAILABLE_PLACEMENTS.map(p => {
                  const isChecked = newPlacements.includes(p);
                  return (
                    <TouchableOpacity
                      key={p}
                      onPress={() => togglePlacement(p)}
                      style={[s.placementSelectChip, isChecked && s.placementSelectChipActive]}
                      activeOpacity={0.7}
                    >
                      <Ionicons name={isChecked ? "checkbox" : "square-outline"} size={11} color={isChecked ? '#0F172A' : L.textMuted} />
                      <Text style={[s.placementSelectText, isChecked && s.placementSelectTextActive]}>{p}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity onPress={saveBanner} disabled={uploading} style={s.saveModalBtn} activeOpacity={0.85}>
                <LinearGradient colors={['#0F172A', '#1E293B']} style={s.saveMainGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  {uploading ? (
                    <ActivityIndicator size="small" color={L.gold} />
                  ) : (
                    <Text style={s.saveMainText}>{editingBannerId ? 'Update Banner' : 'Save & Publish Banner'}</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* PARTNER CREATE / EDIT MODAL */}
      <Modal visible={showPartnerModal} transparent animationType="slide" onRequestClose={closePartnerModal}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{editingPartnerId ? 'Edit Partner Brand' : 'Add Partner Brand'}</Text>
              <TouchableOpacity onPress={closePartnerModal} style={s.modalCloseBtn}>
                <Ionicons name="close" size={16} color={L.navyHeader} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity onPress={pickPartnerLogo} style={s.partnerLogoPicker} activeOpacity={0.8}>
                {newPartnerLogo ? (
                  <Image source={{ uri: newPartnerLogo.uri }} style={s.partnerLogoPreview} resizeMode="contain" />
                ) : existingPartnerLogoUrl ? (
                  <Image source={{ uri: existingPartnerLogoUrl }} style={s.partnerLogoPreview} resizeMode="contain" />
                ) : (
                  <View style={{ alignItems: 'center', gap: 4 }}>
                    <Ionicons name="cloud-upload-outline" size={20} color={L.goldDk} />
                    <Text style={s.imagePickerText}>Upload Square Logo (PNG/JPG)</Text>
                  </View>
                )}
              </TouchableOpacity>

              <Text style={s.inputLabel}>Partner Name</Text>
              <TextInput
                placeholder="e.g. MTN Nigeria, Monnify, Paystack"
                placeholderTextColor="#94A3B8"
                style={s.modalInput}
                value={newPartnerName}
                onChangeText={setNewPartnerName}
              />

              <TouchableOpacity onPress={savePartner} disabled={uploading} style={s.saveModalBtn} activeOpacity={0.85}>
                <LinearGradient colors={['#0F172A', '#1E293B']} style={s.saveMainGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  {uploading ? (
                    <ActivityIndicator size="small" color={L.gold} />
                  ) : (
                    <Text style={s.saveMainText}>{editingPartnerId ? 'Update Partner' : 'Add Partner'}</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: L.bg,
  },
  topBar: {
    backgroundColor: L.navyHeader,
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'ios' ? 44 : 32,
    paddingBottom: 8,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomWidth: 1.5,
    borderColor: L.goldDk,
  },
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  backBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: L.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13.5,
  },
  topBarSub: {
    color: L.goldLight,
    fontSize: 8.5,
    fontWeight: '600',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: L.gold,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 9.5,
  },
  tabBarRow: {
    flexDirection: 'row',
    backgroundColor: '#060B19',
    borderRadius: 10,
    padding: 2,
    gap: 3,
    borderWidth: 1,
    borderColor: 'rgba(218, 165, 32, 0.25)',
  },
  tabPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 5,
    borderRadius: 8,
  },
  tabPillActive: {
    backgroundColor: L.gold,
  },
  tabPillText: {
    color: L.goldLight,
    fontSize: 9,
    fontWeight: '700',
  },
  tabPillTextActive: {
    color: '#0F172A',
    fontWeight: '900',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 60,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 40,
  },
  loadingText: {
    color: L.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: L.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: L.cardBorder,
    marginTop: 10,
    gap: 4,
  },
  emptyTitle: {
    color: L.navyHeader,
    fontWeight: '900',
    fontSize: 13,
  },
  emptySub: {
    color: L.textMuted,
    fontSize: 10,
    textAlign: 'center',
  },
  card: {
    backgroundColor: L.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: L.cardBorder,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  bannerImagePreview: {
    width: '100%',
    height: 120,
    backgroundColor: '#E2E8F0',
  },
  cardBody: {
    padding: 10,
  },
  cardTitle: {
    color: L.navyHeader,
    fontWeight: '800',
    fontSize: 11.5,
  },
  cardUrl: {
    color: L.goldAmber,
    fontSize: 9,
    fontWeight: '600',
    marginTop: 1,
  },
  placementsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
    marginBottom: 8,
  },
  placementBadge: {
    backgroundColor: L.bg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  placementBadgeText: {
    color: L.textMuted,
    fontSize: 8,
    fontWeight: '800',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 6,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: L.bg,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  actionBtnText: {
    color: L.navyHeader,
    fontSize: 9,
    fontWeight: '800',
  },
  partnerCard: {
    backgroundColor: L.card,
    borderRadius: 12,
    padding: 10,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  partnerLogo: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: L.bg,
  },
  partnerName: {
    color: L.navyHeader,
    fontWeight: '800',
    fontSize: 11.5,
  },
  partnerSub: {
    color: L.textMuted,
    fontSize: 8.5,
  },
  iconBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: L.bg,
    borderWidth: 1,
    borderColor: L.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  announcementCard: {
    backgroundColor: L.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  announcementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  announcementTitle: {
    color: L.navyHeader,
    fontWeight: '900',
    fontSize: 12,
  },
  inputLabel: {
    color: L.navyHeader,
    fontSize: 9.5,
    fontWeight: '800',
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  textArea: {
    backgroundColor: L.bg,
    borderWidth: 1,
    borderColor: L.cardBorder,
    borderRadius: 10,
    padding: 8,
    color: L.textPrimary,
    fontSize: 11,
    minHeight: 60,
    marginBottom: 10,
    textAlignVertical: 'top',
  },
  mediaPickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: L.bg,
    borderWidth: 1,
    borderColor: L.cardBorder,
    paddingVertical: 7,
    borderRadius: 8,
  },
  mediaPickBtnText: {
    color: L.navyHeader,
    fontWeight: '800',
    fontSize: 9.5,
  },
  mediaClearBtn: {
    width: 32,
    backgroundColor: L.coralBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: L.coralBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  announcementPreviewBox: {
    position: 'relative',
    height: 100,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  announcementPreviewImg: {
    width: '100%',
    height: '100%',
  },
  announcementTypeTag: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    color: '#FFFFFF',
    fontSize: 7.5,
    fontWeight: '900',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  saveMainBtn: {
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 4,
  },
  saveMainGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
  },
  saveMainText: {
    color: L.gold,
    fontWeight: '900',
    fontSize: 11,
  },
  settingsCard: {
    backgroundColor: L.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  systemSettingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingTitle: {
    color: L.navyHeader,
    fontWeight: '900',
    fontSize: 12,
  },
  settingDesc: {
    color: L.textMuted,
    fontSize: 9,
    marginTop: 2,
    lineHeight: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  modalCard: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: L.card,
    borderRadius: 16,
    padding: 14,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    color: L.navyHeader,
    fontWeight: '900',
    fontSize: 13,
  },
  modalCloseBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: L.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePickerBox: {
    height: 150,
    backgroundColor: L.bg,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: L.cardBorder,
    overflow: 'hidden',
    marginBottom: 8,
  },
  modalImagePreview: {
    width: '100%',
    height: '100%',
  },
  imagePickerPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  imagePickerText: {
    color: L.textMuted,
    fontSize: 9.5,
    fontWeight: '700',
  },
  modalInput: {
    backgroundColor: L.bg,
    borderWidth: 1,
    borderColor: L.cardBorder,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    color: L.textPrimary,
    fontSize: 11,
    marginBottom: 8,
  },
  selectAllText: {
    color: L.goldAmber,
    fontSize: 8.5,
    fontWeight: '800',
  },
  placementSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 12,
  },
  placementSelectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: L.bg,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  placementSelectChipActive: {
    backgroundColor: L.goldLight,
    borderColor: L.goldDk,
  },
  placementSelectText: {
    color: L.textMuted,
    fontSize: 8.5,
    fontWeight: '700',
  },
  placementSelectTextActive: {
    color: '#0F172A',
    fontWeight: '900',
  },
  saveModalBtn: {
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 6,
    marginBottom: 10,
  },
  partnerLogoPicker: {
    height: 80,
    backgroundColor: L.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: L.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  partnerLogoPreview: {
    width: 60,
    height: 60,
  },
});
