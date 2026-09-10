import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
  Switch,
  Dimensions,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import Constants from 'expo-constants';
import { supabase } from '../../services/supabase';
import { safeLaunchPicker } from '../../services/systemPickerTracker';
import { uploadMediaFile } from '../../services/mediaUpload';
import { sendInstantNotification } from '../../hooks/usePushNotifications';
import UpdateScreen from '../../components/UpdateScreen';

const { width } = Dimensions.get('window');

// Executive Brand Theme
const C = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  navy: '#070D1E',
  navyMid: '#0F172A',
  navyCard: '#1E293B',
  gold: '#D97706',
  goldLight: '#FEF3C7',
  goldBorder: '#FDE68A',
  cyan: '#0284C7',
  cyanLight: '#E0F2FE',
  green: '#16A34A',
  greenLight: '#DCFCE7',
  red: '#DC2626',
  redLight: '#FEE2E2',
  border: '#E2E8F0',
  text: '#0F172A',
  sub: '#475569',
  muted: '#94A3B8',
};

const DEFAULT_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.muhammmadsaniishaq.abumafhalsub';

const AI_RELEASE_PRESETS = [
  {
    id: 'ai_v2',
    name: '🤖 AI Next-Gen Engine',
    title: '⚡ Sabon Update na Abu Mafhal Sub v{{version}}!',
    body: 'An saki sabon update mai dauke da sabbin fasahohin AI da saurin sarrafa biyan kudi cikin 0.4s. Danna nan don sabuntawa a Play Store!',
    notes:
      '✨ SABBIN FASAHOHIN AI & SAURIN AIKI:\n' +
      '• 🤖 AI Smart Route Optimizer: Gano layin data mafi sauri ba tare da faduwar network ba.\n' +
      '• ⚡ AI Turbo 0.4s Dispatch: Biyan NEPA, TV da Data cikin kiftawar ido.\n' +
      '• 🛡️ AI Fraud Shield: Cikakken tsaro da kariyar asusunka ta hanyar Biometrics.\n' +
      '• 📊 AI Smart Analytics: Bada shawarwarin saukin farashin data.',
  },
  {
    id: 'perf_fix',
    name: '🚀 Speed & Stability',
    title: '🚀 Muhimmin Update na Abu Mafhal Sub v{{version}}',
    body: 'Mun inganta saurin manhaja da gyara kurakurai don samun gogewa mafi sauki. Danna nan don sabuntawa yanzu!',
    notes:
      '🔧 GYARAN KURAKURAI DA KARIN SAURI:\n' +
      '• Saurin bude shafukan manhaja da kashi 45%.\n' +
      '• Gyaran matsalar tura kudi da sabunta ma\'aunin asusu.\n' +
      '• Inganta karbar sanarwar biyan kudi (Push Notifications).',
  },
  {
    id: 'security_2fa',
    name: '🛡️ Security & 2FA',
    title: '🔒 Sabon Tsaro na Abu Mafhal Sub v{{version}}',
    body: 'An kara ingantaccen tsaron asusu da fasahar 2FA. Da fatan a sabunta don tabbatar da lafiyar asusunka.',
    notes:
      '🛡️ KARIN TSARON ASUSU:\n' +
      '• Sabuwar fasahar tabbatar da sabuwar na\'ura (New Device 2FA).\n' +
      '• Kariya daga kutse da shiga ba tare da izini ba.\n' +
      '• 256-bit bank-grade encryption.',
  },
];

export default function AdminAppUpdate() {
  const router = useRouter();

  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingApk, setUploadingApk] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // App Update Configuration
  const [latestAppVersion, setLatestAppVersion] = useState('1.0.5');
  const [minAppVersion, setMinAppVersion] = useState('1.0.4');
  const [forceAppUpdate, setForceAppUpdate] = useState(false);
  const [playStoreUrl, setPlayStoreUrl] = useState(DEFAULT_PLAY_STORE_URL);
  const [apkDownloadUrl, setApkDownloadUrl] = useState('');
  const [appUpdateMessage, setAppUpdateMessage] = useState(AI_RELEASE_PRESETS[0].notes);

  // Push Broadcast Configuration
  const [broadcastPush, setBroadcastPush] = useState(true);
  const [pushTitle, setPushTitle] = useState('⚡ Sabon Update na Abu Mafhal Sub!');
  const [pushBody, setPushBody] = useState(
    'An saki sabon update mai dauke da sabbin fasahohin AI da saurin aiki. Danna nan don sabuntawa a Play Store kai tsaye!'
  );

  // Installed app version from Expo Constants
  const installedAppVersion = Constants?.expoConfig?.version || '1.0.4';

  useEffect(() => {
    fetchUpdateSettings();
  }, []);

  const fetchUpdateSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('app_settings').select('*');
      if (error) throw error;

      if (data) {
        data.forEach((s) => {
          if (s.key === 'latest_app_version') setLatestAppVersion(s.value || '1.0.5');
          if (s.key === 'min_app_version') setMinAppVersion(s.value || '1.0.4');
          if (s.key === 'force_app_update') setForceAppUpdate(s.value === 'true');
          if (s.key === 'play_store_url') setPlayStoreUrl(s.value || DEFAULT_PLAY_STORE_URL);
          if (s.key === 'apk_download_url') setApkDownloadUrl(s.value || '');
          if (s.key === 'app_update_message' && s.value) setAppUpdateMessage(s.value);
        });
      }
    } catch (err: any) {
      console.warn('[AdminAppUpdate] Fetch error:', err);
      Alert.alert('Gargaɗi', 'An samu matsala wajen ɗauko bayanan update: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (preset: typeof AI_RELEASE_PRESETS[0]) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setAppUpdateMessage(preset.notes);
    setPushTitle(preset.title.replace('{{version}}', latestAppVersion));
    setPushBody(preset.body);
  };

  const handlePickAndUploadApk = async () => {
    try {
      const res = await safeLaunchPicker(async () => {
        return await DocumentPicker.getDocumentAsync({
          type: [
            'application/vnd.android.package-archive',
            'application/octet-stream',
            '*/*',
          ],
          copyToCacheDirectory: true,
        });
      });

      if (res.canceled || !res.assets || res.assets.length === 0) {
        return;
      }

      const file = res.assets[0];
      setUploadingApk(true);

      const fileName = `apks/abumafhal_sub_v${latestAppVersion.replace(/\./g, '_')}_${Date.now()}.apk`;

      const uploadResult = await uploadMediaFile({
        uri: file.uri,
        bucket: 'banners',
        fileName,
        mimeType: 'application/vnd.android.package-archive',
      });

      if (uploadResult.success && uploadResult.publicUrl) {
        setApkDownloadUrl(uploadResult.publicUrl);
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('An Yi Nasara! 🎉', 'An loda fayil ɗin APK cikin nasara kuma an saita hanyar saukewa.');
      } else {
        throw new Error(uploadResult.error || 'Upload failed');
      }
    } catch (err: any) {
      console.error('[AdminAppUpdate] APK Upload error:', err);
      Alert.alert('Kuskure Wajen Loda APK', err.message || 'Ba a samu damar loda fayil ɗin ba. Zaka iya rubuta direct link da hannu.');
    } finally {
      setUploadingApk(false);
    }
  };

  const handleTestInstantPush = async () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const title = pushTitle.replace('{{version}}', latestAppVersion);
      const body = pushBody;
      const targetUrl = playStoreUrl || DEFAULT_PLAY_STORE_URL;

      await sendInstantNotification(
        title,
        body,
        {
          url: targetUrl,
          route: targetUrl,
          type: 'app_update',
          priority: 'high',
        },
        'security'
      );

      Alert.alert(
        'An Aika Sanarwar Gwaji 🔔',
        'An saukar da sanarwar a wayarka! Danna kanta a saman allonka (drop-down) don ganin yadda zata bude Google Play Store kai tsaye.'
      );
    } catch (err: any) {
      Alert.alert('Kuskure', err.message || 'An gaza tura gwajin sanarwa.');
    }
  };

  const handleSaveAndBroadcast = async () => {
    if (!latestAppVersion.trim()) {
      Alert.alert('Kuskure', 'Da fatan a saka sabon lambar version (misali 1.0.5)');
      return;
    }

    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setSaving(true);

    try {
      // 1. Save Settings to app_settings table
      const settingsToUpsert = [
        { key: 'latest_app_version', value: latestAppVersion.trim() },
        { key: 'min_app_version', value: minAppVersion.trim() },
        { key: 'force_app_update', value: String(forceAppUpdate) },
        { key: 'play_store_url', value: playStoreUrl.trim() },
        { key: 'apk_download_url', value: apkDownloadUrl.trim() },
        { key: 'app_update_message', value: appUpdateMessage.trim() },
      ];

      const { error: upsertError } = await supabase
        .from('app_settings')
        .upsert(settingsToUpsert, { onConflict: 'key' });

      if (upsertError) throw upsertError;

      let broadcastCount = 0;
      let notificationStats = '';

      // 2. Broadcast Push Notification if enabled
      if (broadcastPush) {
        const finalTitle = pushTitle.replace('{{version}}', latestAppVersion.trim());
        const finalBody = pushBody.trim();
        const targetUrl = playStoreUrl.trim() || DEFAULT_PLAY_STORE_URL;

        // A. Insert into notifications table for active users
        const { data: userProfiles, error: fetchUsersErr } = await supabase
          .from('profiles')
          .select('id, expo_push_token')
          .limit(2000);

        if (!fetchUsersErr && userProfiles && userProfiles.length > 0) {
          // Chunk notification inserts
          const batchNotifications = userProfiles.map((p) => ({
            user_id: p.id,
            title: finalTitle,
            body: finalBody,
            data: {
              url: targetUrl,
              route: targetUrl,
              type: 'app_update',
              priority: 'high',
            },
            created_at: new Date().toISOString(),
          }));

          // Insert in chunks of 200
          for (let i = 0; i < batchNotifications.length; i += 200) {
            const chunk = batchNotifications.slice(i, i + 200);
            await supabase.from('notifications').insert(chunk);
          }

          // B. Remote Push to Expo Push API for tokens
          const validTokens = userProfiles
            .map((p) => p.expo_push_token)
            .filter(
              (token): token is string =>
                typeof token === 'string' &&
                (token.startsWith('ExponentPushToken[') ||
                  token.startsWith('ExpoPushToken[') ||
                  token.includes('ExpoPushToken') ||
                  token.length > 20)
            );

          broadcastCount = validTokens.length;

          if (validTokens.length > 0) {
            // Expo allows up to 100 messages per batch
            for (let i = 0; i < validTokens.length; i += 100) {
              const tokenChunk = validTokens.slice(i, i + 100);
              const messages = tokenChunk.map((t) => ({
                to: t,
                sound: 'default',
                title: finalTitle,
                body: finalBody,
                channelId: 'security',
                priority: 'high',
                data: {
                  url: targetUrl,
                  route: targetUrl,
                  type: 'app_update',
                  priority: 'high',
                },
              }));

              try {
                await fetch('https://exp.host/--/api/v2/push/send', {
                  method: 'POST',
                  headers: {
                    Accept: 'application/json',
                    'Accept-encoding': 'gzip, deflate',
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(messages),
                });
              } catch (pushBatchErr) {
                console.warn('[AdminAppUpdate] Expo batch send note:', pushBatchErr);
              }
            }
          }
        }

        // C. Also invoke Edge Function for dual redundancy
        try {
          await supabase.functions.invoke('send-communication', {
            body: {
              type: 'push',
              recipient_mode: 'all',
              subject: finalTitle,
              body: finalBody,
              actionRoute: targetUrl,
              url: targetUrl,
              priority: 'high',
            },
          });
        } catch (fnErr) {
          console.log('[AdminAppUpdate] Edge function invoke note:', fnErr);
        }

        // D. Also send instant local notification for current admin
        await sendInstantNotification(
          finalTitle,
          finalBody,
          { url: targetUrl, route: targetUrl, type: 'app_update' },
          'security'
        );

        notificationStats = `\n\n🔔 An tura Push Notifications zuwa ga wayoyi ${broadcastCount || userProfiles?.length || 0} masu rajista! Idan suka danna zai kaisu Play Store kai tsaye.`;
      }

      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert(
        'An Sabunta Cikin Nasara! 🚀',
        `An ajiye sabon update na v${latestAppVersion} a tsarin Abu Mafhal Sub.${notificationStats}`
      );
    } catch (err: any) {
      console.error('[AdminAppUpdate] Save error:', err);
      Alert.alert('Kuskure', err.message || 'An gaza ajiye saitunan update.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={s.centerScreen}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={C.gold} />
        <Text style={s.loadingText}>Ana ɗauko bayanan App Update...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.safeArea} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Top Header */}
      <View style={s.headerBar}>
        <TouchableOpacity
          style={s.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={C.navy} />
        </TouchableOpacity>

        <View style={s.headerTitleWrap}>
          <Text style={s.headerTitle}>App Updates & Releases</Text>
          <Text style={s.headerSub}>OTA Engine • Google Play Store • AI Features</Text>
        </View>

        <TouchableOpacity
          style={s.previewHeaderBtn}
          onPress={() => setShowPreviewModal(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="eye" size={17} color={C.gold} />
          <Text style={s.previewHeaderText}>Preview</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Banner */}
        <LinearGradient
          colors={['#070D1E', '#0F172A']}
          style={s.heroCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={s.heroTopRow}>
            <View style={s.heroIconBox}>
              <Ionicons name="rocket" size={22} color={C.gold} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.heroTitle}>Sakin Sabbin Vershoni na Manhaja</Text>
              <Text style={s.heroSubtitle}>
                Daga nan zaka iya tilasta update, loda sabon APK, rubuta bayanin AI features, da tura sanarwar Play Store ga dukkan users.
              </Text>
            </View>
          </View>

          <View style={s.heroStatsRow}>
            <View style={s.heroStatItem}>
              <Text style={s.heroStatLabel}>Installed v</Text>
              <Text style={s.heroStatValue}>v{installedAppVersion}</Text>
            </View>
            <View style={s.heroStatDivider} />
            <View style={s.heroStatItem}>
              <Text style={s.heroStatLabel}>Latest v</Text>
              <Text style={[s.heroStatValue, { color: '#34d399' }]}>v{latestAppVersion}</Text>
            </View>
            <View style={s.heroStatDivider} />
            <View style={s.heroStatItem}>
              <Text style={s.heroStatLabel}>Min Enforced</Text>
              <Text style={[s.heroStatValue, { color: '#fbbf24' }]}>v{minAppVersion}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Section 1: Version Numbers & Enforcement */}
        <View style={s.sectionCard}>
          <View style={s.sectionHeader}>
            <Ionicons name="git-branch" size={18} color={C.gold} />
            <Text style={s.sectionTitle}>1. Saitin Vershoni (Version Numbers)</Text>
          </View>

          <View style={s.inputRowDual}>
            <View style={s.inputHalf}>
              <Text style={s.label}>Sabuwar Version (Latest)</Text>
              <TextInput
                value={latestAppVersion}
                onChangeText={setLatestAppVersion}
                style={s.input}
                placeholder="1.0.5"
                placeholderTextColor={C.muted}
              />
              <Text style={s.helpHint}>Misali: 1.0.5</Text>
            </View>

            <View style={s.inputHalf}>
              <Text style={s.label}>Mafi Karancin Version (Min)</Text>
              <TextInput
                value={minAppVersion}
                onChangeText={setMinAppVersion}
                style={s.input}
                placeholder="1.0.4"
                placeholderTextColor={C.muted}
              />
              <Text style={s.helpHint}>Wanda ke kasa zai tilasta update</Text>
            </View>
          </View>

          {/* Force Update Toggle */}
          <View style={s.toggleRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={s.toggleTitle}>Tilasta Sabuntawa (Force Update)</Text>
              <Text style={s.toggleSub}>
                Idan aka kunna wannan, kowanne user dole ya sabunta app kafin ya shiga asusunsa.
              </Text>
            </View>
            <Switch
              value={forceAppUpdate}
              onValueChange={setForceAppUpdate}
              trackColor={{ true: C.gold, false: '#CBD5E1' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Section 2: Download Links & APK Upload */}
        <View style={s.sectionCard}>
          <View style={s.sectionHeader}>
            <Ionicons name="cloud-download" size={18} color={C.cyan} />
            <Text style={s.sectionTitle}>2. Hanyoyin Saukewa (Play Store & APK)</Text>
          </View>

          {/* Google Play Store Link */}
          <View style={s.inputGroup}>
            <Text style={s.label}>Google Play Store URL</Text>
            <View style={s.inputWithIcon}>
              <Ionicons name="logo-google-playstore" size={20} color={C.green} style={s.inputIcon} />
              <TextInput
                value={playStoreUrl}
                onChangeText={setPlayStoreUrl}
                style={[s.input, { paddingLeft: 42 }]}
                placeholder={DEFAULT_PLAY_STORE_URL}
                placeholderTextColor={C.muted}
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Direct APK File URL & Upload */}
          <View style={s.inputGroup}>
            <Text style={s.label}>Direct APK File URL (Uptodown / Direct Server)</Text>
            <View style={s.inputWithIcon}>
              <Ionicons name="link-outline" size={20} color={C.cyan} style={s.inputIcon} />
              <TextInput
                value={apkDownloadUrl}
                onChangeText={setApkDownloadUrl}
                style={[s.input, { paddingLeft: 42 }]}
                placeholder="https://abumafhal.com.ng/download/app.apk"
                placeholderTextColor={C.muted}
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Upload APK Button */}
          <TouchableOpacity
            style={s.uploadApkBtn}
            activeOpacity={0.8}
            onPress={handlePickAndUploadApk}
            disabled={uploadingApk}
          >
            {uploadingApk ? (
              <ActivityIndicator size="small" color={C.gold} />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={20} color={C.gold} style={{ marginRight: 8 }} />
                <Text style={s.uploadApkText}>Loda Sabon Fayil ɗin .APK Daga Na'ura</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Section 3: AI Release Notes Presets & Editor */}
        <View style={s.sectionCard}>
          <View style={s.sectionHeader}>
            <Ionicons name="sparkles" size={18} color={C.gold} />
            <Text style={s.sectionTitle}>3. Bayanin Sabuntawa & AI Features (Release Notes)</Text>
          </View>

          <Text style={s.presetTitle}>Zaɓi Salo na Musamman (One-Tap Presets):</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.presetScroll}
          >
            {AI_RELEASE_PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset.id}
                style={s.presetChip}
                onPress={() => applyPreset(preset)}
                activeOpacity={0.75}
              >
                <Text style={s.presetChipText}>{preset.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={s.inputGroup}>
            <Text style={s.label}>Bayanin da User Zai Gani a Screen (Hausa/English)</Text>
            <TextInput
              value={appUpdateMessage}
              onChangeText={setAppUpdateMessage}
              style={[s.input, s.textArea]}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              placeholder="Rubuta bayanin abubuwan da aka inganta da fasahohin AI..."
              placeholderTextColor={C.muted}
            />
          </View>
        </View>

        {/* Section 4: Push Notification Broadcast to All Users */}
        <View style={s.sectionCard}>
          <View style={s.sectionHeader}>
            <Ionicons name="megaphone" size={18} color={C.red} />
            <Text style={s.sectionTitle}>4. Tura Sanarwar Wayar Salula (Push Broadcast)</Text>
          </View>

          <View style={s.toggleRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={s.toggleTitle}>Aika Push Notification Yayin Ajiye Update</Text>
              <Text style={s.toggleSub}>
                Sanarwar zata shiga saman wayar kowanne user (status bar heads-up). Idan ya danna, zata bude Play Store kai tsaye.
              </Text>
            </View>
            <Switch
              value={broadcastPush}
              onValueChange={setBroadcastPush}
              trackColor={{ true: C.green, false: '#CBD5E1' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {broadcastPush && (
            <>
              <View style={s.inputGroup}>
                <Text style={s.label}>Taken Sanarwa (Notification Title)</Text>
                <TextInput
                  value={pushTitle}
                  onChangeText={setPushTitle}
                  style={s.input}
                  placeholder="⚡ Sabon Update na Abu Mafhal Sub!"
                  placeholderTextColor={C.muted}
                />
              </View>

              <View style={s.inputGroup}>
                <Text style={s.label}>Sakon Sanarwa (Notification Body)</Text>
                <TextInput
                  value={pushBody}
                  onChangeText={setPushBody}
                  style={[s.input, { minHeight: 70 }]}
                  multiline
                  placeholder="An saki sabon update..."
                  placeholderTextColor={C.muted}
                />
              </View>

              {/* Action notice */}
              <View style={s.actionNoticeBox}>
                <Ionicons name="information-circle" size={18} color={C.gold} />
                <Text style={s.actionNoticeText}>
                  Ayyukan Danna Sanarwa: Idan user ya taɓa wannan sanarwa a wayarsa, tsarin zai buɗe shafin Google Play Store kai tsaye ba tare da ya sha wahalar bincike ba!
                </Text>
              </View>

              {/* Test Button */}
              <TouchableOpacity
                style={s.testPushBtn}
                onPress={handleTestInstantPush}
                activeOpacity={0.8}
              >
                <Ionicons name="notifications-circle" size={18} color={C.cyan} style={{ marginRight: 8 }} />
                <Text style={s.testPushText}>Gwada Tura Sanarwa a Wayata Yanzu (Test Push)</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Primary Action Button: Save & Broadcast */}
        <TouchableOpacity
          style={s.saveButton}
          onPress={handleSaveAndBroadcast}
          activeOpacity={0.88}
          disabled={saving}
        >
          <LinearGradient
            colors={['#D97706', '#B45309']}
            style={s.saveGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="paper-plane" size={20} color="#FFFFFF" style={{ marginRight: 10 }} />
                <Text style={s.saveText}>
                  {broadcastPush ? 'Ajiye & Aika Push Notification Zuwa Users' : 'Ajiye Saitunan Update Kawai'}
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Live Preview Button */}
        <TouchableOpacity
          style={s.previewBtnBottom}
          onPress={() => setShowPreviewModal(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="phone-portrait-outline" size={18} color={C.navy} style={{ marginRight: 8 }} />
          <Text style={s.previewBtnBottomText}>Duba Yadda Allon Update Zai Fito (Live Screen Preview)</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal for Live Preview of UpdateScreen */}
      <Modal
        visible={showPreviewModal}
        animationType="slide"
        onRequestClose={() => setShowPreviewModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#040814' }}>
          {/* Top close bar */}
          <View style={s.modalCloseBar}>
            <Text style={s.modalCloseTitle}>LIVE PREVIEW: Yadda User Zai Gani</Text>
            <TouchableOpacity
              onPress={() => setShowPreviewModal(false)}
              style={s.modalCloseBtn}
            >
              <Ionicons name="close-circle" size={26} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Render Actual UpdateScreen */}
          <UpdateScreen
            currentVersion={installedAppVersion}
            latestVersion={latestAppVersion}
            playStoreUrl={playStoreUrl}
            apkDownloadUrl={apkDownloadUrl}
            message={appUpdateMessage}
            isForced={forceAppUpdate}
            onDismiss={() => setShowPreviewModal(false)}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: C.bg,
  },
  centerScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.bg,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: C.sub,
    fontWeight: '600',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: C.navy,
  },
  headerSub: {
    fontSize: 11,
    color: C.muted,
    fontWeight: '600',
  },
  previewHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.goldLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.goldBorder,
    gap: 4,
  },
  previewHeaderText: {
    fontSize: 12,
    fontWeight: '800',
    color: C.gold,
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 50,
  },
  heroCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  heroIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 3,
  },
  heroSubtitle: {
    fontSize: 11.5,
    color: '#94A3B8',
    lineHeight: 16,
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  heroStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  heroStatLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  heroStatValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  sectionCard: {
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: C.navy,
  },
  inputRowDual: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  inputHalf: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: C.navyMid,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 13.5,
    color: C.text,
    fontWeight: '600',
  },
  inputWithIcon: {
    position: 'relative',
    justifyContent: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: 12,
    zIndex: 1,
  },
  helpHint: {
    fontSize: 10.5,
    color: C.muted,
    marginTop: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.navy,
    marginBottom: 2,
  },
  toggleSub: {
    fontSize: 11,
    color: C.muted,
    lineHeight: 15,
  },
  uploadApkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.goldLight,
    borderWidth: 1,
    borderColor: C.goldBorder,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 4,
  },
  uploadApkText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: C.gold,
  },
  presetTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: C.sub,
    marginBottom: 8,
  },
  presetScroll: {
    marginBottom: 14,
  },
  presetChip: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    marginRight: 8,
  },
  presetChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1E40AF',
  },
  textArea: {
    minHeight: 110,
    lineHeight: 18,
  },
  actionNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: C.goldLight,
    borderWidth: 1,
    borderColor: C.goldBorder,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginBottom: 14,
  },
  actionNoticeText: {
    flex: 1,
    fontSize: 11.5,
    color: '#92400E',
    lineHeight: 16,
    fontWeight: '600',
  },
  testPushBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.cyanLight,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 12,
    paddingVertical: 11,
  },
  testPushText: {
    fontSize: 12,
    fontWeight: '800',
    color: C.cyan,
  },
  saveButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
    marginBottom: 14,
  },
  saveGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  saveText: {
    fontSize: 14.5,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  previewBtnBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 13,
    borderRadius: 14,
  },
  previewBtnBottomText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: C.navy,
  },
  modalCloseBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#070D1E',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalCloseTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: C.gold,
    letterSpacing: 0.5,
  },
  modalCloseBtn: {
    padding: 4,
  },
});
