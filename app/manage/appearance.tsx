import {
  View, Text, TouchableOpacity, ScrollView, Platform, Image,
  ActivityIndicator, Alert, StyleSheet, TextInput, Switch, Dimensions, Modal
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../services/supabase';
import CelebrationConfetti, {
  CelebrationConfettiRef, CelebrationSettings, EVENT_PRESETS, triggerGlobalConfetti
} from '../../components/CelebrationConfetti';
import { safeLaunchPicker } from '../../services/systemPickerTracker';
import { uploadMediaFile } from '../../services/mediaUpload';

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
  indigoL: '#EEF2FF',
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
  const { tab } = useLocalSearchParams<{ tab: string }>();
  const [activeTab, setActiveTab] = useState<'celebration' | 'theme' | 'branding' | 'splash'>(
    tab === 'splash' || tab === 'theme' || tab === 'branding' ? (tab as any) : 'celebration'
  );

  useEffect(() => {
    if (tab && ['celebration', 'theme', 'branding', 'splash'].includes(tab)) {
      setActiveTab(tab as any);
    }
  }, [tab]);

  // Theme states
  const [primaryColor, setPrimaryColor] = useState('#D97706');
  const [darkMode, setDarkMode] = useState(false);

  // Branding states
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoIconUrl, setLogoIconUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Splash slides states
  type SplashSlide = { id: string; url: string; order: number; title?: string };
  const [splashSlides, setSplashSlides] = useState<SplashSlide[]>([]);
  const [uploadingSlide, setUploadingSlide] = useState(false);
  const [savingSlides, setSavingSlides] = useState(false);
  const [activeSlotTarget, setActiveSlotTarget] = useState<number>(0);
  const [showSlidePickerModal, setShowSlidePickerModal] = useState(false);
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [urlInputValue, setUrlInputValue] = useState('');
  const [showLivePreviewModal, setShowLivePreviewModal] = useState(false);
  const [previewActiveIndex, setPreviewActiveIndex] = useState(0);

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
    fetchSplashSlides();
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
        .maybeSingle();

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

  const fetchSplashSlides = async () => {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'app_splash_slides')
        .maybeSingle();

      if (data?.value) {
        let parsed = data.value;
        if (typeof parsed === 'string') {
          try { parsed = JSON.parse(parsed); } catch {}
        }
        if (typeof parsed === 'string') {
          try { parsed = JSON.parse(parsed); } catch {}
        }
        if (Array.isArray(parsed)) {
          const normalized = [0, 1, 2].map(slot => {
            const found = parsed.find((s: any) => s.order === slot);
            const cleanUrl = (found?.url && typeof found.url === 'string' && !found.url.startsWith('blob:')) ? found.url : '';
            return { id: `slide_${slot}`, url: cleanUrl, order: slot };
          });
          setSplashSlides(normalized);
          await AsyncStorage.setItem('cached_splash_slides_v3', JSON.stringify(normalized));
          return;
        }
      }
      setSplashSlides([
        { id: 'slide_0', url: '', order: 0 },
        { id: 'slide_1', url: '', order: 1 },
        { id: 'slide_2', url: '', order: 2 },
      ]);
    } catch (e) {
      console.log('No splash slides yet:', e);
    }
  };

  // Core 3-Screen Luxury Splash Structure
  const CORE_SPLASH_SCREENS = [
    {
      slot: 0,
      badge: 'Screen 1',
      tag: 'GLOBAL FINTECH GATEWAY',
      title: 'Your Gateway to Seamless Payments',
      subtitle: 'Instant automated delivery for data bundles, airtime, utility bills, and worldwide virtual card transactions.',
      defaultAsset: require('../../assets/images/splash_globe_3d.png'),
      defaultLabel: '3D Golden World Globe (Built-in)',
      accent: '#D97706',
      accentLight: '#FEF3C7',
      icon: 'globe-outline' as const,
    },
    {
      slot: 1,
      badge: 'Screen 2',
      tag: 'ALL-IN-ONE AUTOMATION',
      title: 'Your All-in-One Digital Hub',
      subtitle: 'Fast, secure, and automated transactions. Manage all your airtime, data bundles, electricity, and cable TV in one spot.',
      defaultAsset: require('../../assets/images/splash_hub_phone_3d.png'),
      defaultLabel: '3D Smartphone Hub (Built-in)',
      accent: '#4F46E5',
      accentLight: '#EEF2FF',
      icon: 'phone-portrait-outline' as const,
    },
    {
      slot: 2,
      badge: 'Screen 3',
      tag: 'TRUST, SPEED & SECURITY',
      title: 'Experience Luxury Fintech',
      subtitle: 'Join thousands enjoying seamless transactions nationwide with institutional security & instant wallet funding.',
      defaultAsset: require('../../assets/images/vc_card_stack_3d_real.png'),
      defaultLabel: '3D Metallic Virtual Cards Stack (Built-in)',
      accent: '#16A34A',
      accentLight: '#F0FDF4',
      icon: 'shield-checkmark-outline' as const,
    },
  ];

  const SPLASH_3D_PRESETS = [
    {
      id: 'preset_globe',
      title: '3D Gold Globe Ring',
      category: 'Global Fintech',
      url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
      desc: 'Deep black & shimmering gold luxury orb',
    },
    {
      id: 'preset_cards',
      title: 'Cyber Virtual Cards',
      category: 'Virtual Banking',
      url: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800&auto=format&fit=crop&q=80',
      desc: 'Floating corporate black and gold debit cards',
    },
    {
      id: 'preset_neon',
      title: 'Digital Hub Mobile',
      category: 'Sub-second VTU',
      url: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&auto=format&fit=crop&q=80',
      desc: 'Futuristic glowing connectivity lines',
    },
    {
      id: 'preset_skyline',
      title: 'Executive Financial Tower',
      category: 'Institutional',
      url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=80',
      desc: 'Glass architectural wealth & stability',
    },
  ];

  interface PickedImageResult {
    uri: string;
    dataUri: string;
    base64: string;
    mimeType: string;
    isGif: boolean;
    width?: number;
    height?: number;
  }

  // Cross-platform, bulletproof image picker:
  // Preserves full animated GIF frames (does not flatten GIFs into static JPEG!)
  // On Web: Uses synchronous HTML5 file input with FileReader (100% reliable, zero CORS/popup issues, never blocked)
  // On Native: Uses Expo ImagePicker + ImageManipulator
  const pickMediaCrossPlatform = async (source: 'camera' | 'library'): Promise<PickedImageResult | null> => {
    // ── 1. WEB PLATFORM ──
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      return new Promise((resolve) => {
        try {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          if (source === 'camera') {
            input.setAttribute('capture', 'environment');
          }
          input.style.position = 'fixed';
          input.style.top = '-9999px';
          input.style.left = '-9999px';
          input.style.opacity = '0';
          document.body.appendChild(input);

          let hasResolved = false;
          const cleanup = () => {
            if (input.parentNode) {
              input.parentNode.removeChild(input);
            }
          };

          input.onchange = async (e: any) => {
            if (hasResolved) return;
            hasResolved = true;
            const file: File | undefined = e.target?.files?.[0];
            cleanup();
            if (!file) {
              resolve(null);
              return;
            }

            const isGif = file.type === 'image/gif' || file.name?.toLowerCase().endsWith('.gif');

            try {
              const reader = new FileReader();
              reader.onload = (readerEvent) => {
                const rawDataUrl = readerEvent.target?.result as string;
                if (!rawDataUrl || typeof rawDataUrl !== 'string') {
                  resolve(null);
                  return;
                }

                const rawBase64 = rawDataUrl.includes(',') ? rawDataUrl.split(',')[1] : rawDataUrl;

                // CRITICAL FOR ANIMATED GIFS: DO NOT pass through canvas!
                // Canvas destroys animated GIF frames and turns it into a dead static image.
                if (isGif) {
                  resolve({
                    uri: rawDataUrl,
                    dataUri: rawDataUrl,
                    base64: rawBase64,
                    mimeType: 'image/gif',
                    isGif: true,
                  });
                  return;
                }

                // Offscreen canvas compression for standard static images (JPEG/PNG) to ~80KB max 900px
                const img = new (window as any).Image();
                img.onload = () => {
                  try {
                    const canvas = document.createElement('canvas');
                    const maxDim = 900;
                    let w = img.naturalWidth || img.width || 800;
                    let h = img.naturalHeight || img.height || 600;
                    if (w > maxDim || h > maxDim) {
                      if (w > h) {
                        h = Math.round((h * maxDim) / w);
                        w = maxDim;
                      } else {
                        w = Math.round((w * maxDim) / h);
                        h = maxDim;
                      }
                    }
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                      ctx.drawImage(img, 0, 0, w, h);
                      const compressed = canvas.toDataURL('image/jpeg', 0.82);
                      const compBase64 = compressed.includes(',') ? compressed.split(',')[1] : compressed;
                      resolve({
                        uri: compressed,
                        dataUri: compressed,
                        base64: compBase64,
                        mimeType: 'image/jpeg',
                        isGif: false,
                        width: w,
                        height: h,
                      });
                      return;
                    }
                  } catch (canvasErr) {
                    console.warn('Canvas resize notice:', canvasErr);
                  }
                  resolve({
                    uri: rawDataUrl,
                    dataUri: rawDataUrl,
                    base64: rawBase64,
                    mimeType: 'image/jpeg',
                    isGif: false,
                  });
                };
                img.onerror = () => {
                  resolve({
                    uri: rawDataUrl,
                    dataUri: rawDataUrl,
                    base64: rawBase64,
                    mimeType: 'image/jpeg',
                    isGif: false,
                  });
                };
                img.src = rawDataUrl;
              };
              reader.onerror = () => {
                cleanup();
                resolve(null);
              };
              reader.readAsDataURL(file);
            } catch (err) {
              console.error('Web file reading error:', err);
              cleanup();
              resolve(null);
            }
          };

          // Synchronous trigger in user gesture stack
          input.click();

          // Auto-cleanup on focus return if user cancels file dialog
          if (typeof window !== 'undefined') {
            window.addEventListener('focus', () => {
              setTimeout(() => {
                if (!hasResolved) {
                  setTimeout(() => {
                    if (!hasResolved && (!input.files || input.files.length === 0)) {
                      hasResolved = true;
                      cleanup();
                      resolve(null);
                    }
                  }, 1200);
                }
              }, 400);
            }, { once: true });
          }
        } catch (err: any) {
          console.error('Web picker launch failed:', err);
          resolve(null);
        }
      });
    }

    // ── 2. NATIVE PLATFORM (iOS & Android) ──
    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(
            "Izinin Kamara (Camera Permission)",
            "Don Allah bada izinin amfani da kamara a wayarka domin daukar hoto."
          );
          return null;
        }
        const result = await safeLaunchPicker(() => ImagePicker.launchCameraAsync({
          allowsEditing: false,
          quality: 0.8,
          base64: true,
        }));
        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          const isGif = asset.uri?.toLowerCase().endsWith('.gif') || (asset as any)?.mimeType === 'image/gif';
          if (isGif) {
            const b64 = asset.base64 || '';
            const dataUri = b64 ? `data:image/gif;base64,${b64}` : asset.uri;
            return {
              uri: asset.uri,
              dataUri,
              base64: b64,
              mimeType: 'image/gif',
              isGif: true,
              width: asset.width,
              height: asset.height,
            };
          }
          try {
            const manip = await ImageManipulator.manipulateAsync(
              asset.uri,
              [{ resize: { width: 900 } }],
              { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
            );
            const b64 = manip.base64 || asset.base64 || '';
            const dataUri = `data:image/jpeg;base64,${b64}`;
            return {
              uri: manip.uri,
              dataUri,
              base64: b64,
              mimeType: 'image/jpeg',
              isGif: false,
              width: manip.width,
              height: manip.height,
            };
          } catch {
            const b64 = asset.base64 || '';
            return {
              uri: asset.uri,
              dataUri: b64 ? `data:image/jpeg;base64,${b64}` : asset.uri,
              base64: b64,
              mimeType: 'image/jpeg',
              isGif: false,
            };
          }
        }
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(
            "Izinin Hotuna (Gallery Permission)",
            "Don Allah bada izinin shiga hotunanka a wayarka domin zaban hoto."
          );
          return null;
        }
        const result = await safeLaunchPicker(() => ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 0.8,
          base64: true,
        }));
        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          const isGif = asset.uri?.toLowerCase().endsWith('.gif') || (asset as any)?.mimeType === 'image/gif';
          if (isGif) {
            const b64 = asset.base64 || '';
            const dataUri = b64 ? `data:image/gif;base64,${b64}` : asset.uri;
            return {
              uri: asset.uri,
              dataUri,
              base64: b64,
              mimeType: 'image/gif',
              isGif: true,
              width: asset.width,
              height: asset.height,
            };
          }
          try {
            const manip = await ImageManipulator.manipulateAsync(
              asset.uri,
              [{ resize: { width: 900 } }],
              { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
            );
            const b64 = manip.base64 || asset.base64 || '';
            const dataUri = `data:image/jpeg;base64,${b64}`;
            return {
              uri: manip.uri,
              dataUri,
              base64: b64,
              mimeType: 'image/jpeg',
              isGif: false,
              width: manip.width,
              height: manip.height,
            };
          } catch {
            const b64 = asset.base64 || '';
            return {
              uri: asset.uri,
              dataUri: b64 ? `data:image/jpeg;base64,${b64}` : asset.uri,
              base64: b64,
              mimeType: 'image/jpeg',
              isGif: false,
            };
          }
        }
      }
      return null;
    } catch (e: any) {
      console.error("Native image pick error:", e);
      Alert.alert("Daukar Hoto", e.message || "Ba a samu nasarar daukar hoton ba.");
      return null;
    }
  };

  const getSlideForSlot = (slot: number): SplashSlide | undefined => {
    return splashSlides.find(s => s.order === slot);
  };

  const applySlideImage = async (slot: number, imageUrl: string, silent: boolean = false) => {
    const current = [...splashSlides];
    const updated = [0, 1, 2].map((sIndex) => {
      if (sIndex === slot) {
        return { id: `slide_${sIndex}`, url: imageUrl, order: sIndex };
      }
      const found = current.find(s => s.order === sIndex);
      return found || { id: `slide_${sIndex}`, url: '', order: sIndex };
    });
    setSplashSlides(updated);
    const saved = await saveSplashSlidesToDB(updated);
    if (saved && !silent) {
      Alert.alert("An Sabunta Hoto! 🎉", `Hoton Page/Slide #${slot + 1} an sabunta shi kuma an adana shi cikin nasara.`);
    }
  };

  const handleUploadFromSource = async (slot: number, source: 'camera' | 'library') => {
    try {
      // 1. Launch rock-solid picker immediately in user gesture
      const picked = await pickMediaCrossPlatform(source);
      if (!picked) {
        return;
      }

      setUploadingSlide(true);

      // 2. Guaranteed permanent data-URI (instant zero-delay display & safe persistence)
      const initialUrl = picked.dataUri.startsWith('data:image/') ? picked.dataUri : picked.uri;

      // STEP 1: Apply immediately to local state and DB!
      // This displays the animated GIF or image INSTANTLY!
      await applySlideImage(slot, initialUrl, false);

      // STEP 2: Background upload to Supabase CDN Storage bucket
      try {
        const ext = picked.isGif ? 'gif' : 'jpg';
        const mime = picked.mimeType || (picked.isGif ? 'image/gif' : 'image/jpeg');
        const fileName = `splash/slide_${slot + 1}_${Date.now()}.${ext}`;

        const uploadRes = await uploadMediaFile({
          uri: picked.uri,
          bucket: 'banners',
          fileName,
          mimeType: mime,
          base64: picked.base64,
          isVideo: false,
        });

        if (uploadRes?.success && uploadRes?.publicUrl && uploadRes.publicUrl.startsWith('http')) {
          // Seamlessly update to CDN URL silently
          await applySlideImage(slot, uploadRes.publicUrl, true);
        }
      } catch (uploadErr) {
        console.warn('Background CDN storage upload notice (local data-URI remains active):', uploadErr);
      }
    } catch (e: any) {
      console.error("Slide upload error:", e);
      Alert.alert("Daukar Hoto", e.message || "Ba a samu nasarar loda hoton ba.");
    } finally {
      setUploadingSlide(false);
    }
  };

  const handleApplyUrl = async () => {
    const trimmed = urlInputValue.trim();
    if (!trimmed || !trimmed.startsWith('http')) {
      Alert.alert("Invalid URL", "Please enter a valid https:// image link.");
      return;
    }
    setShowUrlModal(false);
    setUrlInputValue('');
    await applySlideImage(activeSlotTarget, trimmed);
  };

  const handleResetSlideToDefault = async (slot: number) => {
    Alert.alert(
      "Koma Default 3D Asset ↺",
      `Kuna son share hoton Page #${slot + 1} ku dawo da asalin 3D asset din splash din?`,
      [
        { text: "A'a (Cancel)", style: "cancel" },
        {
          text: "Eh, Koma Default",
          style: "destructive",
          onPress: async () => {
            const current = [...splashSlides];
            const updated = [0, 1, 2].map((sIndex) => {
              if (sIndex === slot) {
                return { id: `slide_${sIndex}`, url: '', order: sIndex };
              }
              const found = current.find(s => s.order === sIndex);
              return found || { id: `slide_${sIndex}`, url: '', order: sIndex };
            });
            setSplashSlides(updated);
            await saveSplashSlidesToDB(updated);
            Alert.alert("An Mayar da Default ✓", `Page #${slot + 1} ya koma babban 3D graphic dinsa.`);
          }
        }
      ]
    );
  };

  const handleDeleteSplashSlide = async (id: string) => {
    const updated = splashSlides.filter(s => s.id !== id).map((s, i) => ({ ...s, order: i }));
    setSplashSlides(updated);
    await saveSplashSlidesToDB(updated);
  };

  const saveSplashSlidesToDB = async (slides: any[]): Promise<boolean> => {
    setSavingSlides(true);
    try {
      const jsonPayload = JSON.stringify(slides);
      const { error } = await supabase.from('app_settings').upsert({
        key: 'app_splash_slides',
        value: jsonPayload,
        description: 'Custom splash screen slide images',
      }, { onConflict: 'key' });

      if (error) {
        throw error;
      }

      await AsyncStorage.setItem('cached_splash_slides_v3', jsonPayload);
      return true;
    } catch (e: any) {
      console.error('Save splash slides error:', e);
      Alert.alert('Save Error', e.message || 'Ba a samu nasarar adana hotunan splash ba.');
      return false;
    } finally {
      setSavingSlides(false);
    }
  };

  const handleManualSaveSplashSlides = async () => {
    const success = await saveSplashSlidesToDB(splashSlides);
    if (success) {
      Alert.alert(
        "An Adana Cikin Nasara! 🎉",
        "Dukkan sauye-sauyen splash screen da hotuna an adana su kuma suna aiki kai tsaye ga duk masu amfani da manhaja."
      );
    }
  };

  const toggleCelebrationEnabled = async (val: boolean) => {
    const updated = { ...celebrationSettings, is_enabled: val };
    setCelebrationSettings(updated);
    try {
      await supabase
        .from('app_settings')
        .upsert({
          key: 'celebration_event_settings',
          value: JSON.stringify(updated),
          description: 'Active holiday celebration and button confetti configuration'
        }, { onConflict: 'key' });
    } catch (e) {
      console.error('Error saving celebration toggle:', e);
    }
  };

  const toggleConfettiOnTap = async (val: boolean) => {
    const updated = { ...celebrationSettings, confetti_on_tap: val };
    setCelebrationSettings(updated);
    try {
      await supabase
        .from('app_settings')
        .upsert({
          key: 'celebration_event_settings',
          value: JSON.stringify(updated),
          description: 'Active holiday celebration and button confetti configuration'
        }, { onConflict: 'key' });
    } catch (e) {}
  };

  const toggleShowBanner = async (val: boolean) => {
    const updated = { ...celebrationSettings, show_banner: val };
    setCelebrationSettings(updated);
    try {
      await supabase
        .from('app_settings')
        .upsert({
          key: 'celebration_event_settings',
          value: JSON.stringify(updated),
          description: 'Active holiday celebration and button confetti configuration'
        }, { onConflict: 'key' });
    } catch (e) {}
  };

  const saveCelebrationSettings = async () => {
    setSavingCelebration(true);
    try {
      const payload = JSON.stringify(celebrationSettings);
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          key: 'celebration_event_settings',
          value: payload,
          description: 'Active holiday celebration and button confetti configuration'
        }, { onConflict: 'key' });

      if (error) throw error;
      triggerGlobalConfetti(W / 2, 100, true);
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
    Alert.alert(
      type === 'icon' ? "Upload App Icon Square" : "Upload Full Logo Banner",
      "Zabi yadda kake son daukar hoto / choose image source:",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "📸 Dauki Hoto (Camera)",
          onPress: async () => {
            const picked = await pickMediaCrossPlatform('camera');
            if (picked) await uploadBrandLogo(picked, type);
          }
        },
        {
          text: "🖼️ Zabi daga Gallery",
          onPress: async () => {
            const picked = await pickMediaCrossPlatform('library');
            if (picked) await uploadBrandLogo(picked, type);
          }
        }
      ]
    );
  };

  const uploadBrandLogo = async (picked: PickedImageResult, type: 'logo' | 'icon') => {
    const isIcon = type === 'icon';
    if (isIcon) setUploadingIcon(true);
    else setUploadingLogo(true);

    try {
      const ext = picked.isGif ? 'gif' : 'jpg';
      const mime = picked.mimeType || (picked.isGif ? 'image/gif' : 'image/jpeg');
      const fileName = `brand/${type}_${Date.now()}.${ext}`;
      const initialUrl = picked.dataUri.startsWith('data:image/') ? picked.dataUri : picked.uri;

      // Immediate visual update
      if (isIcon) setLogoIconUrl(initialUrl);
      else setLogoUrl(initialUrl);

      // Save initialUrl to DB
      await supabase
        .from('app_settings')
        .upsert({
          key: isIcon ? 'app_logo_icon' : 'app_logo',
          value: { url: initialUrl },
          description: isIcon ? 'Dynamic App Logo Icon Square' : 'Dynamic App Logo Banner Full'
        }, { onConflict: 'key' });

      // Try CDN storage upload in background
      try {
        const uploadRes = await uploadMediaFile({
          uri: picked.uri,
          bucket: 'banners',
          fileName,
          mimeType: mime,
          base64: picked.base64,
          isVideo: false,
        });

        if (uploadRes?.success && uploadRes?.publicUrl && uploadRes.publicUrl.startsWith('http')) {
          if (isIcon) setLogoIconUrl(uploadRes.publicUrl);
          else setLogoUrl(uploadRes.publicUrl);

          await supabase
            .from('app_settings')
            .upsert({
              key: isIcon ? 'app_logo_icon' : 'app_logo',
              value: { url: uploadRes.publicUrl },
              description: isIcon ? 'Dynamic App Logo Icon Square' : 'Dynamic App Logo Banner Full'
            }, { onConflict: 'key' });
        }
      } catch (uploadErr) {
        console.warn('Brand logo storage upload notice:', uploadErr);
      }

      Alert.alert("Success 🎉", `${isIcon ? 'App Icon' : 'Logo Banner'} an sabunta shi cikin nasara!`);
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

          <TouchableOpacity
            onPress={() => setActiveTab('splash')}
            style={[s.tabButton, activeTab === 'splash' && s.tabButtonActive]}
          >
            <Ionicons name="phone-portrait" size={14} color={activeTab === 'splash' ? T.navy : 'rgba(255,255,255,0.7)'} />
            <Text style={[s.tabText, activeTab === 'splash' && s.tabTextActive]}>Splash</Text>
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
                  onValueChange={toggleCelebrationEnabled}
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
                  onValueChange={toggleConfettiOnTap}
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
                  onValueChange={toggleShowBanner}
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
                onPress={() => triggerGlobalConfetti(W / 2, 200, true)}
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

        {/* ═══════════════════════════════════════════════════════════════════════
            TAB 4: MODERN SPLASH ARCHITECTURE & VISUALS
        ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'splash' && (
          <View style={{ gap: 16 }}>
            {/* Header info & action card */}
            <View style={s.card}>
              <View style={s.cardHeaderRow}>
                <View style={[s.iconBadge, { backgroundColor: T.goldL }]}>
                  <Ionicons name="sparkles" size={20} color={T.gold} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={s.cardTitle}>Splash Screen Architecture & Visuals</Text>
                  <Text style={s.cardSubtitle}>
                    Saita hotunan splash screen din manhaja na farko (Screen 1, 2, 3) cikin salon zamani.
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                <TouchableOpacity
                  style={[s.splashHeaderActionBtn, { backgroundColor: T.navy }]}
                  onPress={() => setShowLivePreviewModal(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="phone-portrait-outline" size={15} color={T.goldB} />
                  <Text style={[s.splashHeaderActionTxt, { color: '#FFFFFF' }]}>Live Phone Mockup</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.splashHeaderActionBtn, { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: T.gold }]}
                  onPress={() => router.push('/?preview=splash' as any)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="play-circle" size={15} color={T.gold} />
                  <Text style={[s.splashHeaderActionTxt, { color: T.navy }]}>Launch Full Splash</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── 3 CORE SCREEN CARDS ── */}
            {CORE_SPLASH_SCREENS.map((core) => {
              const customSlide = getSlideForSlot(core.slot);
              const hasCustomImage = Boolean(customSlide?.url && customSlide.url.trim().length > 0);

              return (
                <View key={core.slot} style={[s.card, { borderColor: hasCustomImage ? T.gold : T.border }]}>
                  {/* Top Bar with Badge & Status */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={[s.iconBadge, { width: 30, height: 30, borderRadius: 8, backgroundColor: core.accentLight }]}>
                        <Ionicons name={core.icon} size={16} color={core.accent} />
                      </View>
                      <View>
                        <Text style={{ fontSize: 13, fontWeight: '900', color: T.navy }}>{core.badge}</Text>
                        <Text style={{ fontSize: 9, fontWeight: '800', color: core.accent, letterSpacing: 0.5 }}>{core.tag}</Text>
                      </View>
                    </View>

                    <View style={[
                      s.splashStatusPill,
                      { backgroundColor: hasCustomImage ? T.greenL : T.goldL, borderColor: hasCustomImage ? T.green : T.gold }
                    ]}>
                      <View style={[s.pulseDot, { backgroundColor: hasCustomImage ? T.green : T.gold }]} />
                      <Text style={[s.splashStatusTxt, { color: hasCustomImage ? T.green : T.gold }]}>
                        {hasCustomImage ? 'Custom Photo Active' : '3D Built-in Active'}
                      </Text>
                    </View>
                  </View>

                  {/* Artwork Preview Box with Blurred Backdrop & Seamless Edge Melting */}
                  <View style={s.modernArtworkBox}>
                    {/* Blurred Ambient Image Aura (True Gaussian blur on Web & Mobile) */}
                    <Image
                      source={hasCustomImage ? { uri: customSlide!.url } : core.defaultAsset}
                      style={[
                        StyleSheet.absoluteFillObject,
                        {
                          opacity: 0.72,
                          transform: [{ scale: 1.25 }],
                          ...(Platform.OS === 'web' ? { filter: 'blur(30px)', WebkitFilter: 'blur(30px)' } as any : {}),
                        }
                      ]}
                      blurRadius={Platform.OS === 'ios' ? 26 : 20}
                      resizeMode="cover"
                    />

                    <LinearGradient
                      colors={['rgba(255,255,255,0.72)', 'rgba(254,243,199,0.25)', 'rgba(255,255,255,0.72)']}
                      style={StyleSheet.absoluteFill}
                    />

                    {/* Corner golden accents */}
                    <View style={[s.cornerAccent, { top: 6, left: 6, borderTopWidth: 2, borderLeftWidth: 2 }]} />
                    <View style={[s.cornerAccent, { bottom: 6, right: 6, borderBottomWidth: 2, borderRightWidth: 2 }]} />

                    {/* Inset centered image with seamless edge melting */}
                    <View
                      style={[
                        { width: '92%', height: '88%', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 16, position: 'relative' },
                        Platform.OS === 'web' ? {
                          maskImage: 'radial-gradient(ellipse 92% 90% at 50% 50%, black 65%, transparent 100%)',
                          WebkitMaskImage: 'radial-gradient(ellipse 92% 90% at 50% 50%, black 65%, transparent 100%)',
                        } as any : {}
                      ]}
                    >
                      <Image
                        source={hasCustomImage ? { uri: customSlide!.url } : core.defaultAsset}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="contain"
                      />

                      {/* 4-Way Smooth Vignette Fades to melt edges */}
                      <LinearGradient colors={['rgba(255,255,255,0.92)', 'rgba(255,255,255,0.5)', 'transparent']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 32 }} pointerEvents="none" />
                      <LinearGradient colors={['transparent', 'rgba(255,255,255,0.5)', 'rgba(255,255,255,0.92)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 32 }} pointerEvents="none" />
                      <LinearGradient start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} colors={['rgba(255,255,255,0.9)', 'transparent']} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 28 }} pointerEvents="none" />
                      <LinearGradient start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} colors={['transparent', 'rgba(255,255,255,0.9)']} style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 28 }} pointerEvents="none" />
                    </View>

                    <View style={s.artworkCaptionPill}>
                      <Text style={s.artworkCaptionTxt} numberOfLines={1}>
                        {hasCustomImage ? (customSlide?.url.includes('.gif') || customSlide?.url.startsWith('data:image/gif') ? 'Custom Animated GIF Live 🎬' : 'Custom Asset Live') : core.defaultLabel}
                      </Text>
                    </View>
                  </View>

                  {/* Content Summary */}
                  <View style={{ marginVertical: 10 }}>
                    <Text style={{ fontSize: 12.5, fontWeight: '900', color: T.navy }}>{core.title}</Text>
                    <Text style={{ fontSize: 10, color: T.textSub, marginTop: 2, lineHeight: 14 }}>{core.subtitle}</Text>
                  </View>

                  {/* Modern Action Buttons Grid */}
                  <View style={s.modernActionsGrid}>
                    <TouchableOpacity
                      style={[s.modernMiniBtn, { backgroundColor: T.navy }]}
                      onPress={() => handleUploadFromSource(core.slot, 'camera')}
                      disabled={uploadingSlide}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="camera" size={13} color={T.gold} />
                      <Text style={[s.modernMiniBtnTxt, { color: '#FFFFFF' }]}>Dauki Kamara</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[s.modernMiniBtn, { backgroundColor: T.goldL, borderWidth: 1, borderColor: T.gold }]}
                      onPress={() => handleUploadFromSource(core.slot, 'library')}
                      disabled={uploadingSlide}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="images" size={13} color={T.gold} />
                      <Text style={[s.modernMiniBtnTxt, { color: T.navy }]}>Gallery</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[s.modernMiniBtn, { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: T.border }]}
                      onPress={() => {
                        setActiveSlotTarget(core.slot);
                        setUrlInputValue(customSlide?.url || '');
                        setShowUrlModal(true);
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="link-outline" size={13} color={T.textSub} />
                      <Text style={[s.modernMiniBtnTxt, { color: T.textSub }]}>Saka URL</Text>
                    </TouchableOpacity>

                    {hasCustomImage && (
                      <TouchableOpacity
                        style={[s.modernMiniBtn, { backgroundColor: T.redL, borderWidth: 1, borderColor: '#FECDD3' }]}
                        onPress={() => handleResetSlideToDefault(core.slot)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="refresh" size={13} color={T.red} />
                        <Text style={[s.modernMiniBtnTxt, { color: T.red }]}>Reset 3D</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}

            {/* ── CURATED 3D PRESETS GALLERY ── */}
            <View style={s.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <View style={[s.iconBadge, { backgroundColor: T.indigoL, width: 32, height: 32 }]}>
                  <Ionicons name="color-palette" size={16} color={T.indigo} />
                </View>
                <View style={{ marginLeft: 8, flex: 1 }}>
                  <Text style={s.cardTitle}>Curated 3D Modern Presets</Text>
                  <Text style={s.cardSubtitle}>Zabi kyawawan hotuna na 3D domin amfani a kowane slide nan take</Text>
                </View>
              </View>

              <View style={{ gap: 10 }}>
                {SPLASH_3D_PRESETS.map((preset) => (
                  <View key={preset.id} style={s.presetCardRow}>
                    <Image source={{ uri: preset.url }} style={s.presetThumb} resizeMode="cover" />
                    <View style={{ flex: 1, marginLeft: 10, marginRight: 6 }}>
                      <Text style={{ fontSize: 11.5, fontWeight: '900', color: T.navy }}>{preset.title}</Text>
                      <Text style={{ fontSize: 8.5, fontWeight: '800', color: T.gold, marginTop: 1 }}>{preset.category}</Text>
                      <Text style={{ fontSize: 9, color: T.textSub, marginTop: 2 }} numberOfLines={1}>{preset.desc}</Text>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      {[0, 1, 2].map((slot) => (
                        <TouchableOpacity
                          key={slot}
                          onPress={() => applySlideImage(slot, preset.url)}
                          style={s.presetApplyPill}
                          activeOpacity={0.7}
                        >
                          <Text style={s.presetApplyTxt}>S#{slot + 1}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Master Save Splash Settings Button */}
            <TouchableOpacity
              style={{
                borderRadius: 14,
                overflow: 'hidden',
                marginTop: 10,
                marginBottom: 6,
                elevation: 4,
                shadowColor: T.navy,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 8,
              }}
              onPress={handleManualSaveSplashSlides}
              disabled={savingSlides || uploadingSlide}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[T.navy, T.navyMid]}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 14,
                  gap: 8,
                }}
              >
                {savingSlides ? (
                  <ActivityIndicator color={T.gold} size="small" />
                ) : (
                  <>
                    <Ionicons name="save" size={17} color={T.gold} />
                    <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '900', letterSpacing: 0.3 }}>
                      Adana Saitunan Splash (Save Changes)
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Saving / Sync Indicator */}
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 }}>
              {uploadingSlide || savingSlides ? (
                <>
                  <ActivityIndicator color={T.gold} size="small" />
                  <Text style={{ color: T.gold, fontSize: 11, fontWeight: '800' }}>
                    {uploadingSlide ? 'Ana loda hoton zuwa storage…' : 'Ana adana saitunan splash…'}
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="cloud-done" size={16} color={T.green} />
                  <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '700' }}>
                    All splash screens synced & live
                  </Text>
                </>
              )}
            </View>
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            MODAL 1: DIRECT IMAGE URL INPUT MODAL
        ═══════════════════════════════════════════════════════════════════════ */}
        <Modal visible={showUrlModal} transparent animationType="fade" onRequestClose={() => setShowUrlModal(false)}>
          <View style={s.modalOverlay}>
            <View style={s.modalBox}>
              <View style={s.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="link" size={18} color={T.gold} />
                  <Text style={s.modalTitle}>Saka Direct Image URL (Slide #{activeSlotTarget + 1})</Text>
                </View>
                <TouchableOpacity onPress={() => setShowUrlModal(false)}>
                  <Ionicons name="close-circle" size={22} color={T.textSub} />
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 10.5, color: T.textSub, marginBottom: 12 }}>
                Saka link din hoto ko GIF mai inganci (misali daga CDN ko hoton kamfani).
              </Text>

              <TextInput
                style={s.modalInput}
                placeholder="https://example.com/banner.png"
                placeholderTextColor="#94A3B8"
                value={urlInputValue}
                onChangeText={setUrlInputValue}
                autoCapitalize="none"
                autoCorrect={false}
              />

              {urlInputValue.trim().startsWith('http') && (
                <View style={s.modalPreviewMini}>
                  <Image source={{ uri: urlInputValue.trim() }} style={{ width: '100%', height: '100%', borderRadius: 8 }} resizeMode="contain" />
                </View>
              )}

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                  style={[s.modalBtn, { backgroundColor: '#F1F5F9' }]}
                  onPress={() => setShowUrlModal(false)}
                >
                  <Text style={{ fontSize: 12, fontWeight: '800', color: T.textSub }}>Soke (Cancel)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.modalBtn, { backgroundColor: T.navy }]}
                  onPress={handleApplyUrl}
                >
                  <Text style={{ fontSize: 12, fontWeight: '900', color: T.gold }}>Aiwatar da Hoton ✓</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ═══════════════════════════════════════════════════════════════════════
            MODAL 2: INTERACTIVE LIVE PHONE MOCKUP PREVIEW
        ═══════════════════════════════════════════════════════════════════════ */}
        <Modal visible={showLivePreviewModal} transparent animationType="slide" onRequestClose={() => setShowLivePreviewModal(false)}>
          <View style={s.modalOverlay}>
            <View style={s.phoneFrameBox}>
              {/* Phone Header Notch & Bezel */}
              <View style={s.phoneTopBar}>
                <View style={s.phoneSpeakerNotch} />
                <TouchableOpacity
                  style={s.phoneCloseBtn}
                  onPress={() => setShowLivePreviewModal(false)}
                >
                  <Ionicons name="close" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {/* Phone Screen Canvas */}
              <View style={s.phoneScreenCanvas}>
                {/* Mini Brand Header */}
                <View style={{ alignItems: 'center', marginTop: 10, marginBottom: 8 }}>
                  <View style={s.miniBrandHalo}>
                    <Image
                      source={logoUrl ? { uri: logoUrl } : require('../../assets/images/logo.png')}
                      style={{ width: 44, height: 44, borderRadius: 22 }}
                      resizeMode="contain"
                    />
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: '900', color: T.navy, marginTop: 4 }}>ABU MAFHAL SUB</Text>
                  <Text style={{ fontSize: 8, color: T.gold, fontWeight: '800', letterSpacing: 1.5 }}>LUXURY FINTECH HUB</Text>
                </View>

                {/* Active Slide Rendering in Phone */}
                {(() => {
                  const core = CORE_SPLASH_SCREENS[previewActiveIndex];
                  const custom = getSlideForSlot(core.slot);
                  const hasCustom = Boolean(custom?.url && custom.url.trim().length > 0);

                  return (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}>
                      {/* Badge */}
                      <View style={[s.splashStatusPill, { backgroundColor: T.goldL, borderColor: T.goldB }]}>
                        <Ionicons name="sparkles" size={10} color={T.gold} />
                        <Text style={[s.splashStatusTxt, { color: T.navy, fontSize: 8.5 }]}>{core.tag}</Text>
                      </View>

                      {/* Floating Artwork with Blurred Backdrop & Seamless Edge Melting */}
                      <View style={s.phoneHeroArtworkBox}>
                        {/* Blurred Ambient Image Aura (Gaussian blur for Web & Mobile) */}
                        <Image
                          source={hasCustom ? { uri: custom!.url } : core.defaultAsset}
                          style={[
                            StyleSheet.absoluteFillObject,
                            {
                              opacity: 0.72,
                              transform: [{ scale: 1.25 }],
                              ...(Platform.OS === 'web' ? { filter: 'blur(30px)', WebkitFilter: 'blur(30px)' } as any : {}),
                            }
                          ]}
                          blurRadius={Platform.OS === 'ios' ? 26 : 20}
                          resizeMode="cover"
                        />

                        <LinearGradient
                          colors={['rgba(255,255,255,0.72)', 'rgba(254,243,199,0.25)', 'rgba(255,255,255,0.72)']}
                          style={StyleSheet.absoluteFill}
                        />

                        {/* Inset centered image with seamless edge melting */}
                        <View
                          style={[
                            { width: '90%', height: '88%', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 14, position: 'relative' },
                            Platform.OS === 'web' ? {
                              maskImage: 'radial-gradient(ellipse 92% 90% at 50% 50%, black 65%, transparent 100%)',
                              WebkitMaskImage: 'radial-gradient(ellipse 92% 90% at 50% 50%, black 65%, transparent 100%)',
                            } as any : {}
                          ]}
                        >
                          <Image
                            source={hasCustom ? { uri: custom!.url } : core.defaultAsset}
                            style={{ width: '100%', height: '100%' }}
                            resizeMode="contain"
                          />

                          {/* 4-Way Smooth Vignette Fades */}
                          <LinearGradient colors={['rgba(255,255,255,0.92)', 'rgba(255,255,255,0.5)', 'transparent']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 26 }} pointerEvents="none" />
                          <LinearGradient colors={['transparent', 'rgba(255,255,255,0.5)', 'rgba(255,255,255,0.92)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 26 }} pointerEvents="none" />
                          <LinearGradient start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} colors={['rgba(255,255,255,0.9)', 'transparent']} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 22 }} pointerEvents="none" />
                          <LinearGradient start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} colors={['transparent', 'rgba(255,255,255,0.9)']} style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 22 }} pointerEvents="none" />
                        </View>
                      </View>

                      {/* Content */}
                      <View style={{ alignItems: 'center', marginTop: 8 }}>
                        <Text style={{ fontSize: 13, fontWeight: '900', color: T.navy, textAlign: 'center' }}>
                          {core.title}
                        </Text>
                        <Text style={{ fontSize: 9, color: T.textSub, textAlign: 'center', marginTop: 3, lineHeight: 13 }}>
                          {core.subtitle}
                        </Text>
                      </View>

                      {/* Bottom Slide Indicators & Next Button */}
                      <View style={{ width: '100%', alignItems: 'center', marginVertical: 12 }}>
                        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
                          {[0, 1, 2].map((idx) => (
                            <TouchableOpacity
                              key={idx}
                              onPress={() => setPreviewActiveIndex(idx)}
                              style={[
                                s.phoneDot,
                                previewActiveIndex === idx && { width: 22, backgroundColor: T.gold }
                              ]}
                            />
                          ))}
                        </View>

                        <TouchableOpacity
                          style={s.phoneActionButton}
                          onPress={() => {
                            if (previewActiveIndex < 2) setPreviewActiveIndex(p => p + 1);
                            else setPreviewActiveIndex(0);
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '900' }}>
                            {previewActiveIndex < 2 ? 'Next Screen ➔' : 'Get Started Now ✦'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })()}
              </View>

              {/* Bottom Test Button */}
              <TouchableOpacity
                style={s.phoneFullTestBtn}
                onPress={() => {
                  setShowLivePreviewModal(false);
                  router.push('/?preview=splash' as any);
                }}
              >
                <Ionicons name="open-outline" size={14} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>Launch Full App Splash</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  splashPreviewBox: {
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
  },

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

  // Modern Splash Manager Styles
  splashHeaderActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  splashHeaderActionTxt: {
    fontSize: 11,
    fontWeight: '900',
  },
  splashStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  splashStatusTxt: {
    fontSize: 9,
    fontWeight: '800',
  },
  modernArtworkBox: {
    height: 180,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  cornerAccent: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderColor: T.gold,
  },
  artworkCaptionPill: {
    position: 'absolute',
    bottom: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  artworkCaptionTxt: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  modernActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  modernMiniBtn: {
    flex: 1,
    minWidth: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
    gap: 4,
  },
  modernMiniBtnTxt: {
    fontSize: 10,
    fontWeight: '900',
  },
  presetCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: T.border,
  },
  presetThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#0F172A',
  },
  presetApplyPill: {
    backgroundColor: T.navy,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 6,
  },
  presetApplyTxt: {
    color: T.goldB,
    fontSize: 8.5,
    fontWeight: '900',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBox: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: T.gold,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderColor: T.border,
  },
  modalTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: T.navy,
  },
  modalInput: {
    backgroundColor: T.bg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    color: T.navy,
    borderWidth: 1,
    borderColor: T.border,
  },
  modalPreviewMini: {
    height: 120,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: T.border,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Phone Mockup Frame Styles
  phoneFrameBox: {
    width: Math.min(340, W - 32),
    height: Math.min(620, Dimensions.get('window').height * 0.88),
    backgroundColor: '#0B0F19',
    borderRadius: 36,
    padding: 8,
    borderWidth: 4,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 12,
  },
  phoneTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 6,
  },
  phoneSpeakerNotch: {
    width: 60,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#1E293B',
    alignSelf: 'center',
  },
  phoneCloseBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneScreenCanvas: {
    flex: 1,
    backgroundColor: '#FDFBF7',
    borderRadius: 28,
    overflow: 'hidden',
    paddingTop: 8,
  },
  miniBrandHalo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: T.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneHeroArtworkBox: {
    width: '100%',
    height: 170,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginVertical: 6,
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  phoneDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#CBD5E1',
  },
  phoneActionButton: {
    width: '100%',
    backgroundColor: T.navy,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: T.gold,
  },
  phoneFullTestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    marginTop: 6,
  },
});
