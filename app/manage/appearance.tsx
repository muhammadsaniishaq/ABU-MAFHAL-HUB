import {
  View, Text, TouchableOpacity, ScrollView, Platform, Image,
  ActivityIndicator, Alert, StyleSheet, TextInput, Switch, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../services/supabase';
import CelebrationConfetti, {
  CelebrationConfettiRef, CelebrationSettings, EVENT_PRESETS, triggerGlobalConfetti
} from '../../components/CelebrationConfetti';

const { width: W } = Dimensions.get('window');

const T = {
  navy:    '#0F172A',
  navyMid: '#1E293B',
  gold:    '#D97706',
  goldL:   '#FEF3C7',
  goldB:   '#FCD34D',
  white:   '#FFFFFF',
  bg:      '#F5F3EE',
  text:    '#0F172A',
  textSub: '#475569',
  indigo:  '#4F46E5',
  border:  '#E2E8F0',
  green:   '#16A34A',
  greenL:  '#F0FDF4',
  red:     '#DC2626',
  redL:    '#FEF2F2',
};

const EVENT_TYPES = [
  { id: 'milestone',           label: 'User Milestone',     icon: 'trophy',           desc: 'Hit 50k+ users, transaction records' },
  { id: 'company_anniversary', label: 'Company Anniversary',icon: 'ribbon',           desc: 'Celebrating years of success' },
  { id: 'maulid',              label: 'Maulud Nabiyy',      icon: 'heart',            desc: 'Green & golden Islamic celebration' },
  { id: 'eid',                 label: 'Eid Mubarak',        icon: 'moon',             desc: 'Crescent, stars & emerald gold ribbons' },
  { id: 'jummah',              label: 'Jumu\'at Mubarak',   icon: 'sunny',            desc: 'Friday blessings celebration' },
  { id: 'new_year',            label: 'New Year',           icon: 'sparkles',         desc: 'Fireworks, gold & crimson confetti' },
  { id: 'independence',        label: 'Independence Day',   icon: 'flag',             desc: 'Green & white patriotic celebration' },
  { id: 'ramadan',             label: 'Ramadan Kareem',     icon: 'moon-outline',     desc: 'Golden lanterns & peaceful crescent' },
  { id: 'black_friday',        label: 'Mega Promo / Sale',  icon: 'flash',            desc: 'Special discount frenzy & bonuses' },
  { id: 'holiday',             label: 'Holiday Festival',   icon: 'gift',             desc: 'Festive season ribbons & sparkles' },
  { id: 'custom',              label: 'Special Custom',     icon: 'rocket',           desc: 'Custom title, subtitle & confetti' },
];

export default function AppDesigner() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'celebration' | 'theme' | 'branding'>('celebration');

  // Theme states
  const [primaryColor, setPrimaryColor] = useState('#D97706');
  const [darkMode, setDarkMode] = useState(false);

  // Branding states
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoIconUrl, setLogoIconUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Celebration / Festive states
  const [celebrationSettings, setCelebrationSettings] = useState<CelebrationSettings>({
    is_enabled: true,
    event_type: 'eid',
    event_title: 'Eid Mubarak! 🌙✨',
    event_subtitle: 'May this blessed season bring joy, peace and prosperity to you and your family.',
    confetti_on_tap: true,
    show_banner: true,
  });
  const [savingCelebration, setSavingCelebration] = useState(false);
  const confettiRef = useRef<CelebrationConfettiRef>(null);

  useEffect(() => {
    fetchBrandSettings();
    fetchCelebrationSettings();
  }, []);

  const fetchBrandSettings = async () => {
    try {
      setLoadingSettings(true);
      const { data } = await supabase
        .from('app_settings')
        .select('key, value');

      if (data) {
        const logoSetting = data.find(s => s.key === 'app_logo');
        const iconSetting = data.find(s => s.key === 'app_logo_icon');
        if (logoSetting?.value?.url) setLogoUrl(logoSetting.value.url);
        if (iconSetting?.value?.url) setLogoIconUrl(iconSetting.value.url);
      }
    } catch (e) {
      console.error('Error fetching brand settings:', e);
    } finally {
      setLoadingSettings(false);
    }
  };

  const fetchCelebrationSettings = async () => {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'celebration_event_settings')
        .single();

      if (data?.value) {
        const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
        if (parsed && typeof parsed === 'object') {
          setCelebrationSettings(parsed);
        }
      }
    } catch (e) {
      console.log('No celebration settings yet or error:', e);
    }
  };

  const saveCelebrationSettings = async () => {
    setSavingCelebration(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          key: 'celebration_event_settings',
          value: celebrationSettings,
          description: 'Active holiday celebration and button confetti configuration'
        }, { onConflict: 'key' });

      if (error) throw error;
      triggerGlobalConfetti(W / 2, 100);
      Alert.alert('Celebration Mode Published! 🎉', 'Event settings and button confetti are now live for all app users.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingCelebration(false);
    }
  };

  const handleSelectEventType = (typeId: string) => {
    const preset = EVENT_PRESETS[typeId] || EVENT_PRESETS.eid;
    setCelebrationSettings(prev => ({
      ...prev,
      event_type: typeId as any,
      event_title: preset.defaultTitle,
      event_subtitle: preset.defaultSubtitle,
    }));
  };

  const handleUploadLogo = async (type: 'logo' | 'icon') => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.granted === false) {
        Alert.alert("Permission Denied", "You need to allow access to your photos to upload brand assets.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        await uploadToSupabase(result.assets[0], type);
      }
    } catch (error: any) {
      Alert.alert("Error", "Could not pick image: " + error.message);
    }
  };

  const uploadToSupabase = async (image: ImagePicker.ImagePickerAsset, type: 'logo' | 'icon') => {
    const isIcon = type === 'icon';
    if (isIcon) setUploadingIcon(true);
    else setUploadingLogo(true);

    try {
      if (!image.base64) throw new Error('No image data found.');

      const fileExt = 'jpg';
      const fileName = `brand/${type}_${Date.now()}.${fileExt}`;

      const { error } = await supabase
        .storage
        .from('banners')
        .upload(fileName, decode(image.base64), {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase
        .storage
        .from('banners')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from('app_settings')
        .upsert({
          key: isIcon ? 'app_logo_icon' : 'app_logo',
          value: { url: publicUrl },
          description: isIcon ? 'Dynamic App Logo Icon Square' : 'Dynamic App Logo Banner Full'
        }, { onConflict: 'key' });

      if (dbError) throw dbError;

      if (isIcon) {
        setLogoIconUrl(publicUrl);
        Alert.alert("Success", "Logo Icon uploaded and published successfully!");
      } else {
        setLogoUrl(publicUrl);
        Alert.alert("Success", "Logo Banner uploaded and published successfully!");
      }
    } catch (error: any) {
      Alert.alert("Upload Failed", error.message);
    } finally {
      if (isIcon) setUploadingIcon(false);
      else setUploadingLogo(false);
    }
  };

  return (
    <View style={s.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <LinearGradient colors={[T.navy, T.navyMid]} style={s.header}>
        <View style={s.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.75}>
            <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={s.headerTitle}>Appearance & Events</Text>
            <Text style={s.headerSub}>Holiday Themes & Confetti Engine</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {/* Tab Selector */}
        <View style={s.tabBar}>
          <TouchableOpacity
            onPress={() => setActiveTab('celebration')}
            style={[s.tabButton, activeTab === 'celebration' && s.tabButtonActive]}
          >
            <Ionicons name="sparkles" size={14} color={activeTab === 'celebration' ? T.navy : 'rgba(255,255,255,0.7)'} />
            <Text style={[s.tabText, activeTab === 'celebration' && s.tabTextActive]}>Event & Confetti</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('theme')}
            style={[s.tabButton, activeTab === 'theme' && s.tabButtonActive]}
          >
            <Ionicons name="color-palette" size={14} color={activeTab === 'theme' ? T.navy : 'rgba(255,255,255,0.7)'} />
            <Text style={[s.tabText, activeTab === 'theme' && s.tabTextActive]}>Theme</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('branding')}
            style={[s.tabButton, activeTab === 'branding' && s.tabButtonActive]}
          >
            <Ionicons name="image" size={14} color={activeTab === 'branding' ? T.navy : 'rgba(255,255,255,0.7)'} />
            <Text style={[s.tabText, activeTab === 'branding' && s.tabTextActive]}>Logos</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Confetti Overlay Engine */}
      <CelebrationConfetti ref={confettiRef} settings={celebrationSettings} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>

        {/* ═══════════════════════════════════════════════════════════════════════
            TAB 1: CELEBRATION & CONFETTI ENGINE
        ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'celebration' && (
          <View>
            {/* Master Toggle Card */}
            <View style={s.card}>
              <View style={s.cardHeaderRow}>
                <View style={[s.iconBadge, { backgroundColor: T.goldL }]}>
                  <Ionicons name="sparkles" size={20} color={T.gold} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={s.cardTitle}>Festive Celebration Mode</Text>
                  <Text style={s.cardSubtitle}>Activate event theme, particles & confetti on user dashboard</Text>
                </View>
                <Switch
                  value={celebrationSettings.is_enabled}
                  onValueChange={(val) => setCelebrationSettings(p => ({ ...p, is_enabled: val }))}
                  trackColor={{ false: '#CBD5E1', true: '#86EFAC' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            {/* Event Type Grid */}
            <Text style={s.sectionHeader}>Select Celebration Event</Text>
            <View style={s.eventsGrid}>
              {EVENT_TYPES.map(ev => {
                const isSelected = celebrationSettings.event_type === ev.id;
                return (
                  <TouchableOpacity
                    key={ev.id}
                    style={[s.eventCard, isSelected && s.eventCardSelected]}
                    onPress={() => handleSelectEventType(ev.id)}
                    activeOpacity={0.75}
                  >
                    <View style={s.eventCardTop}>
                      <View style={[s.eventIconBox, isSelected && { backgroundColor: T.goldL }]}>
                        <Ionicons name={ev.icon as any} size={18} color={isSelected ? T.gold : T.navy} />
                      </View>
                      {isSelected && (
                        <View style={s.selectedBadge}>
                          <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                        </View>
                      )}
                    </View>
                    <Text style={[s.eventTitle, isSelected && { color: T.gold }]}>{ev.label}</Text>
                    <Text style={s.eventDesc}>{ev.desc}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Interactive Options Card */}
            <Text style={s.sectionHeader}>Interactive Particle Triggers</Text>
            <View style={s.card}>
              <View style={s.settingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.settingTitle}>Confetti Burst on Button Taps</Text>
                  <Text style={s.settingDesc}>Explodes colorful celebration particles whenever user taps buttons</Text>
                </View>
                <Switch
                  value={celebrationSettings.confetti_on_tap}
                  onValueChange={(val) => setCelebrationSettings(p => ({ ...p, confetti_on_tap: val }))}
                  trackColor={{ false: '#CBD5E1', true: '#86EFAC' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={[s.settingRow, { borderTopWidth: 1, borderTopColor: T.border, paddingTop: 12 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.settingTitle}>Show Festive Top Banner</Text>
                  <Text style={s.settingDesc}>Displays the holiday greeting bar above user dashboard</Text>
                </View>
                <Switch
                  value={celebrationSettings.show_banner}
                  onValueChange={(val) => setCelebrationSettings(p => ({ ...p, show_banner: val }))}
                  trackColor={{ false: '#CBD5E1', true: '#86EFAC' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            {/* Custom Greetings Inputs */}
            <Text style={s.sectionHeader}>Celebration Greeting Text</Text>
            <View style={s.card}>
              <View style={{ marginBottom: 14 }}>
                <Text style={s.inputLabel}>Greeting Headline Title</Text>
                <TextInput
                  style={s.input}
                  value={celebrationSettings.event_title}
                  onChangeText={(txt) => setCelebrationSettings(p => ({ ...p, event_title: txt }))}
                  placeholder="e.g. Eid Mubarak! 🌙✨"
                  placeholderTextColor="#94A3B8"
                  selectionColor={T.gold}
                />
              </View>

              <View>
                <Text style={s.inputLabel}>Subtitle Message</Text>
                <TextInput
                  style={[s.input, { minHeight: 60, textAlignVertical: 'top' }]}
                  value={celebrationSettings.event_subtitle}
                  onChangeText={(txt) => setCelebrationSettings(p => ({ ...p, event_subtitle: txt }))}
                  placeholder="e.g. Wishing you peace and prosperity..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  selectionColor={T.gold}
                />
              </View>
            </View>

            {/* Live Test & Publish Buttons */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={s.testBtn}
                onPress={() => triggerGlobalConfetti(W / 2, 200)}
                activeOpacity={0.8}
              >
                <Ionicons name="sparkles" size={16} color={T.navy} />
                <Text style={s.testBtnText}>Test Confetti Burst</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.publishBtn}
                onPress={saveCelebrationSettings}
                activeOpacity={0.85}
                disabled={savingCelebration}
              >
                <LinearGradient colors={[T.navy, T.navyMid]} style={s.publishBtnGrad}>
                  {savingCelebration ? (
                    <ActivityIndicator color={T.gold} size="small" />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload" size={16} color={T.gold} />
                      <Text style={s.publishBtnText}>Publish Live</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            TAB 2: THEME COLORS
        ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'theme' && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Color Palette</Text>
            <View style={s.colorGrid}>
              {['#0F172A', '#D97706', '#16A34A', '#2563EB', '#8B5CF6', '#DC2626'].map(c => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setPrimaryColor(c)}
                  style={[s.colorCircle, { backgroundColor: c }, primaryColor === c && s.colorCircleActive]}
                />
              ))}
            </View>

            <Text style={[s.cardTitle, { marginTop: 20 }]}>Mode</Text>
            <View style={s.modeSelector}>
              <TouchableOpacity
                onPress={() => setDarkMode(false)}
                style={[s.modeBtn, !darkMode && s.modeBtnActive]}
              >
                <Ionicons name="sunny" size={18} color={!darkMode ? T.gold : '#94A3B8'} />
                <Text style={[s.modeText, !darkMode && s.modeTextActive]}>Light Theme</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setDarkMode(true)}
                style={[s.modeBtn, darkMode && s.modeBtnActive]}
              >
                <Ionicons name="moon" size={18} color={darkMode ? T.gold : '#94A3B8'} />
                <Text style={[s.modeText, darkMode && s.modeTextActive]}>Dark Theme</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            TAB 3: BRANDING ASSETS
        ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'branding' && (
          <View style={{ gap: 16 }}>
            {/* Logo Banner */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Full Logo Banner</Text>
              <Text style={s.cardSubtitle}>Appears in header, splash screens, and receipts</Text>
              <View style={s.assetPreviewBox}>
                {logoUrl ? (
                  <Image source={{ uri: logoUrl }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                ) : (
                  <Text style={{ color: T.textSub, fontSize: 12 }}>No custom logo uploaded</Text>
                )}
              </View>
              <TouchableOpacity
                style={s.uploadActionBtn}
                onPress={() => handleUploadLogo('logo')}
                activeOpacity={0.8}
              >
                {uploadingLogo ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={16} color="#FFFFFF" />
                    <Text style={s.uploadActionText}>Upload Logo Banner</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Logo Icon */}
            <View style={s.card}>
              <Text style={s.cardTitle}>App Icon Square</Text>
              <Text style={s.cardSubtitle}>Used for avatar watermarks and notification badges</Text>
              <View style={s.assetPreviewBox}>
                {logoIconUrl ? (
                  <Image source={{ uri: logoIconUrl }} style={{ width: 80, height: 80, borderRadius: 16 }} resizeMode="contain" />
                ) : (
                  <Text style={{ color: T.textSub, fontSize: 12 }}>No icon uploaded</Text>
                )}
              </View>
              <TouchableOpacity
                style={s.uploadActionBtn}
                onPress={() => handleUploadLogo('icon')}
                activeOpacity={0.8}
              >
                {uploadingIcon ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={16} color="#FFFFFF" />
                    <Text style={s.uploadActionText}>Upload Icon</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },

  // Header
  header: {
    paddingTop: Platform.OS === 'android' ? 24 : 14,
    paddingBottom: 14,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '900', color: '#FFFFFF' },
  headerSub: { fontSize: 10, color: T.goldB, fontWeight: '700', marginTop: 1 },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    gap: 4,
  },
  tabButtonActive: {
    backgroundColor: T.gold,
    borderColor: T.gold,
  },
  tabText: { fontSize: 10.5, fontWeight: '800', color: 'rgba(255,255,255,0.7)' },
  tabTextActive: { color: T.navy },

  // Section header
  sectionHeader: {
    fontSize: 12,
    fontWeight: '900',
    color: T.navy,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 4,
  },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: T.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBadge: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontSize: 13, fontWeight: '900', color: T.navy },
  cardSubtitle: { fontSize: 10, color: T.textSub, marginTop: 2, lineHeight: 14 },

  // Events Grid
  eventsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  eventCard: {
    width: (W - 32 - 10) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: T.border,
  },
  eventCardSelected: {
    borderColor: T.gold,
    backgroundColor: '#FFFDF7',
  },
  eventCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventIconBox: {
    width: 32, height: 32, borderRadius: 9,
    backgroundColor: '#F1F5F9',
    alignItems: 'center', justifyContent: 'center',
  },
  selectedBadge: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: T.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  eventTitle: { fontSize: 11.5, fontWeight: '900', color: T.navy, marginBottom: 2 },
  eventDesc: { fontSize: 9, color: T.textSub, lineHeight: 12 },

  // Setting Row
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  settingTitle: { fontSize: 12, fontWeight: '800', color: T.navy },
  settingDesc: { fontSize: 9.5, color: T.textSub, marginTop: 2, paddingRight: 10 },

  // Inputs
  inputLabel: { fontSize: 10.5, fontWeight: '800', color: T.navy, marginBottom: 6 },
  input: {
    backgroundColor: T.bg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    fontWeight: '700',
    color: T.navy,
    borderWidth: 1,
    borderColor: T.border,
  },

  // Buttons
  testBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: T.navy,
    gap: 6,
  },
  testBtnText: { fontSize: 12, fontWeight: '900', color: T.navy },
  publishBtn: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  publishBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  publishBtnText: { fontSize: 13, fontWeight: '900', color: T.gold },

  // Color circles
  colorGrid: { flexDirection: 'row', gap: 12, marginTop: 10 },
  colorCircle: { width: 36, height: 36, borderRadius: 18 },
  colorCircleActive: { borderWidth: 3, borderColor: T.gold },

  // Mode buttons
  modeSelector: { flexDirection: 'row', gap: 10, marginTop: 10 },
  modeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 12, backgroundColor: T.bg, gap: 6,
    borderWidth: 1, borderColor: T.border,
  },
  modeBtnActive: { backgroundColor: '#FFFFFF', borderColor: T.gold, borderWidth: 1.5 },
  modeText: { fontSize: 12, fontWeight: '800', color: T.textSub },
  modeTextActive: { color: T.navy },

  // Branding previews
  assetPreviewBox: {
    height: 100,
    backgroundColor: T.bg,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: T.border,
    marginVertical: 12,
    padding: 8,
  },
  uploadActionBtn: {
    backgroundColor: T.navy,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  uploadActionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
});
