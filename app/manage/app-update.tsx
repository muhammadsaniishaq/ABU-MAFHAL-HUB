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
    name: '🤖 AI Performance Core',
    title: '⚡ New Abu Mafhal Sub Update v{{version}}!',
    body: 'A new update featuring AI performance enhancements and 0.4s transaction execution is now live. Tap to update on Google Play!',
    notes:
      'AI & PERFORMANCE ENHANCEMENTS:\n' +
      '• AI Smart Routing: Instant automated gateway switching for 99.9% uptime.\n' +
      '• Turbo Speed: Sub-second 0.4s delivery on Data, Airtime & Utility bills.\n' +
      '• Enhanced Security: Upgraded 2FA biometric verification and 256-bit encryption.\n' +
      '• System Stability: Optimized interface performance and smooth real-time syncing.',
  },
  {
    id: 'perf_fix',
    name: '🚀 Speed & Stability',
    title: '🚀 Important Update: Abu Mafhal Sub v{{version}}',
    body: 'We have optimized app responsiveness and fixed minor issues for a smoother experience. Tap to update now!',
    notes:
      'BUG FIXES & IMPROVEMENTS:\n' +
      '• 45% faster screen rendering and reduced memory consumption.\n' +
      '• Resolved transaction status synchronization edge cases.\n' +
      '• Improved instant push notifications delivery.',
  },
  {
    id: 'security_2fa',
    name: '🛡️ Security & 2FA',
    title: '🔒 Security Upgrade: Abu Mafhal Sub v{{version}}',
    body: 'Enhanced account security and New Device Verification are now active. Please update your app.',
    notes:
      'SECURITY UPGRADES:\n' +
      '• New Device Two-Factor Authentication (2FA) verification.\n' +
      '• Advanced fraud prevention and unauthorized access shielding.\n' +
      '• Upgraded bank-grade API token encryption.',
  },
];

function isVersionLower(currentVersion: string, targetVersion: string): boolean {
  if (!currentVersion || !targetVersion) return false;
  const cleanCurrent = currentVersion.replace(/^v/i, '').trim();
  const cleanTarget = targetVersion.replace(/^v/i, '').trim();
  if (cleanCurrent === cleanTarget) return false;
  const cParts = cleanCurrent.split('.').map(x => parseInt(x, 10) || 0);
  const tParts = cleanTarget.split('.').map(x => parseInt(x, 10) || 0);
  const maxLen = Math.max(cParts.length, tParts.length);
  for (let i = 0; i < maxLen; i++) {
    const c = cParts[i] || 0;
    const t = tParts[i] || 0;
    if (c < t) return true;
    if (c > t) return false;
  }
  return false;
}

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
  const [appStoreUrl, setAppStoreUrl] = useState('https://apps.apple.com/app/abu-mafhal-sub');
  const [apkDownloadUrl, setApkDownloadUrl] = useState('');
  const [appUpdateMessage, setAppUpdateMessage] = useState(AI_RELEASE_PRESETS[0].notes);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Push Broadcast Configuration
  const [broadcastPush, setBroadcastPush] = useState(true);
  const [pushTitle, setPushTitle] = useState('⚡ New Abu Mafhal Sub Update!');
  const [pushBody, setPushBody] = useState(
    'A new update featuring AI performance enhancements is now available. Tap to update directly on Google Play!'
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
          if (s.key === 'app_store_url') setAppStoreUrl(s.value || 'https://apps.apple.com/app/abu-mafhal-sub');
          if (s.key === 'apk_download_url') setApkDownloadUrl(s.value || '');
          if (s.key === 'app_update_message' && s.value) setAppUpdateMessage(s.value);
          if (s.key === 'app_logo') {
            const raw = s.value;
            let resolvedUrl = '';
            if (typeof raw === 'string') {
              if (raw.startsWith('{')) {
                try {
                  const p = JSON.parse(raw);
                  if (p.url) resolvedUrl = p.url;
                } catch {}
              } else if (raw.startsWith('http') || raw.startsWith('data:')) {
                resolvedUrl = raw;
              }
            } else if (raw && typeof raw === 'object' && raw.url) {
              resolvedUrl = raw.url;
            }
            if (resolvedUrl) setLogoUrl(resolvedUrl);
          } else if (s.key === 'app_logo_icon' && !logoUrl) {
            const raw = s.value;
            let resolvedUrl = '';
            if (typeof raw === 'string') {
              if (raw.startsWith('{')) {
                try {
                  const p = JSON.parse(raw);
                  if (p.url) resolvedUrl = p.url;
                } catch {}
              } else if (raw.startsWith('http') || raw.startsWith('data:')) {
                resolvedUrl = raw;
              }
            } else if (raw && typeof raw === 'object' && raw.url) {
              resolvedUrl = raw.url;
            }
            if (resolvedUrl) setLogoUrl(resolvedUrl);
          }
        });
      }
    } catch (err: any) {
      console.warn('[AdminAppUpdate] Fetch error:', err);
      Alert.alert('Notice', 'Failed to retrieve update configuration: ' + err.message);
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
        Alert.alert('Success', 'APK file uploaded successfully. Direct download URL configured.');
      } else {
        throw new Error(uploadResult.error || 'Upload failed');
      }
    } catch (err: any) {
      console.error('[AdminAppUpdate] APK Upload error:', err);
      Alert.alert('Upload Error', err.message || 'Could not upload file. You can enter a direct URL manually.');
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
        'Test Notification Sent 🔔',
        'Check your notification tray. Tapping the notification will immediately open Google Play Store.'
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not dispatch test notification.');
    }
  };

  const handleSaveAndBroadcast = async () => {
    if (!latestAppVersion.trim()) {
      Alert.alert('Error', 'Please enter a valid version number (e.g. 1.0.5)');
      return;
    }

    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setSaving(true);

    const cleanLatest = latestAppVersion.trim();
    const cleanMin = minAppVersion.trim() || cleanLatest;
    const finalLatest = isVersionLower(cleanLatest, cleanMin) ? cleanMin : cleanLatest;
    const finalMin = cleanMin;

    try {
      // 1. Save Settings to app_settings table
      const settingsToUpsert = [
        { key: 'latest_app_version', value: finalLatest },
        { key: 'min_app_version', value: finalMin },
        { key: 'force_app_update', value: String(forceAppUpdate) },
        { key: 'play_store_url', value: playStoreUrl.trim() },
        { key: 'app_store_url', value: appStoreUrl.trim() },
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

          for (let i = 0; i < batchNotifications.length; i += 200) {
            const chunk = batchNotifications.slice(i, i + 200);
            await supabase.from('notifications').insert(chunk);
          }

          // B. Remote Push to Expo Push API
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

        // D. Send local notification for admin device
        await sendInstantNotification(
          finalTitle,
          finalBody,
          { url: targetUrl, route: targetUrl, type: 'app_update' },
          'security'
        );

        notificationStats = `\n\nPush notification dispatched to ${broadcastCount || userProfiles?.length || 0} registered devices. Tapping it opens Google Play directly.`;
      }

      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert(
        'Settings Saved 🚀',
        `Release configuration for v${latestAppVersion} has been saved successfully.${notificationStats}`
      );
    } catch (err: any) {
      console.error('[AdminAppUpdate] Save error:', err);
      Alert.alert('Error', err.message || 'Failed to save update configuration.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={s.centerScreen}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={C.gold} />
        <Text style={s.loadingText}>Loading update configuration...</Text>
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
          <Text style={s.headerSub}>Google Play Store • OTA • Direct APK</Text>
        </View>

        <TouchableOpacity
          style={s.previewHeaderBtn}
          onPress={() => setShowPreviewModal(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="eye-outline" size={16} color={C.gold} />
          <Text style={s.previewHeaderText}>Preview</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Hero Card */}
        <LinearGradient
          colors={['#070D1E', '#0F172A']}
          style={s.heroCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={s.heroTopRow}>
            <View style={s.heroIconBox}>
              <Ionicons name="rocket-outline" size={22} color={C.gold} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.heroTitle}>Release Pipeline Manager</Text>
              <Text style={s.heroSubtitle}>
                Configure target version requirements, upload APK binaries, and broadcast updates to all users.
              </Text>
            </View>
          </View>

          <View style={s.heroStatsRow}>
            <View style={s.heroStatItem}>
              <Text style={s.heroStatLabel}>Installed</Text>
              <Text style={s.heroStatValue}>v{installedAppVersion}</Text>
            </View>
            <View style={s.heroStatDivider} />
            <View style={s.heroStatItem}>
              <Text style={s.heroStatLabel}>Latest Target</Text>
              <Text style={[s.heroStatValue, { color: '#34D399' }]}>v{latestAppVersion}</Text>
            </View>
            <View style={s.heroStatDivider} />
            <View style={s.heroStatItem}>
              <Text style={s.heroStatLabel}>Min Enforced</Text>
              <Text style={[s.heroStatValue, { color: '#FBBF24' }]}>v{minAppVersion}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Section 1: Version Configuration */}
        <View style={s.sectionCard}>
          <View style={s.sectionHeader}>
            <Ionicons name="git-branch-outline" size={17} color={C.gold} />
            <Text style={s.sectionTitle}>1. Version Configuration</Text>
          </View>

          <View style={s.inputRowDual}>
            <View style={s.inputHalf}>
              <Text style={s.label}>Latest Version</Text>
              <TextInput
                value={latestAppVersion}
                onChangeText={setLatestAppVersion}
                style={s.input}
                placeholder="1.0.5"
                placeholderTextColor={C.muted}
              />
            </View>

            <View style={s.inputHalf}>
              <Text style={s.label}>Minimum Required</Text>
              <TextInput
                value={minAppVersion}
                onChangeText={setMinAppVersion}
                style={s.input}
                placeholder="1.0.4"
                placeholderTextColor={C.muted}
              />
            </View>
          </View>

          {/* Force Update Toggle */}
          <View style={s.toggleRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={s.toggleTitle}>Enforce Mandatory Update</Text>
              <Text style={s.toggleSub}>
                Users running versions lower than minimum will be required to update before accessing services.
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

        {/* Section 2: Distribution Links & APK Upload */}
        <View style={s.sectionCard}>
          <View style={s.sectionHeader}>
            <Ionicons name="cloud-download-outline" size={17} color={C.cyan} />
            <Text style={s.sectionTitle}>2. Distribution Channels</Text>
          </View>

          <View style={s.inputGroup}>
            <Text style={s.label}>Google Play Store URL</Text>
            <View style={s.inputWithIcon}>
              <Ionicons name="logo-google-playstore" size={18} color={C.green} style={s.inputIcon} />
              <TextInput
                value={playStoreUrl}
                onChangeText={setPlayStoreUrl}
                style={[s.input, { paddingLeft: 40 }]}
                placeholder={DEFAULT_PLAY_STORE_URL}
                placeholderTextColor={C.muted}
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={s.inputGroup}>
            <Text style={s.label}>Apple App Store URL (iOS Devices)</Text>
            <View style={s.inputWithIcon}>
              <Ionicons name="logo-apple" size={18} color={C.navy} style={s.inputIcon} />
              <TextInput
                value={appStoreUrl}
                onChangeText={setAppStoreUrl}
                style={[s.input, { paddingLeft: 40 }]}
                placeholder="https://apps.apple.com/app/abu-mafhal-sub"
                placeholderTextColor={C.muted}
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={s.inputGroup}>
            <Text style={s.label}>Direct APK Download Link (Optional)</Text>
            <View style={s.inputWithIcon}>
              <Ionicons name="link-outline" size={18} color={C.cyan} style={s.inputIcon} />
              <TextInput
                value={apkDownloadUrl}
                onChangeText={setApkDownloadUrl}
                style={[s.input, { paddingLeft: 40 }]}
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
                <Ionicons name="cloud-upload-outline" size={18} color={C.gold} style={{ marginRight: 8 }} />
                <Text style={s.uploadApkText}>Upload New APK Binary (.apk)</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Section 3: Release Notes Presets & Editor */}
        <View style={s.sectionCard}>
          <View style={s.sectionHeader}>
            <Ionicons name="sparkles-outline" size={17} color={C.gold} />
            <Text style={s.sectionTitle}>3. Release Notes & Highlights</Text>
          </View>

          <Text style={s.presetTitle}>Quick Templates:</Text>
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
            <Text style={s.label}>Release Notes Displayed to Users</Text>
            <TextInput
              value={appUpdateMessage}
              onChangeText={setAppUpdateMessage}
              style={[s.input, s.textArea]}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              placeholder="Enter release notes and highlights..."
              placeholderTextColor={C.muted}
            />
          </View>
        </View>

        {/* Section 4: Push Notification Broadcast */}
        <View style={s.sectionCard}>
          <View style={s.sectionHeader}>
            <Ionicons name="megaphone-outline" size={17} color={C.red} />
            <Text style={s.sectionTitle}>4. Push Notification Broadcast</Text>
          </View>

          <View style={s.toggleRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={s.toggleTitle}>Broadcast Push on Save</Text>
              <Text style={s.toggleSub}>
                Sends a high-priority notification to all user devices. Tapping it immediately opens Google Play Store.
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
                <Text style={s.label}>Notification Title</Text>
                <TextInput
                  value={pushTitle}
                  onChangeText={setPushTitle}
                  style={s.input}
                  placeholder="⚡ New Abu Mafhal Sub Update!"
                  placeholderTextColor={C.muted}
                />
              </View>

              <View style={s.inputGroup}>
                <Text style={s.label}>Notification Message</Text>
                <TextInput
                  value={pushBody}
                  onChangeText={setPushBody}
                  style={[s.input, { minHeight: 65 }]}
                  multiline
                  placeholder="A new update is now available..."
                  placeholderTextColor={C.muted}
                />
              </View>

              <View style={s.actionNoticeBox}>
                <Ionicons name="information-circle-outline" size={18} color={C.gold} />
                <Text style={s.actionNoticeText}>
                  Direct Action: When any user taps this notification on their phone, it will open the Google Play Store update page directly.
                </Text>
              </View>

              <TouchableOpacity
                style={s.testPushBtn}
                onPress={handleTestInstantPush}
                activeOpacity={0.8}
              >
                <Ionicons name="notifications-circle" size={18} color={C.cyan} style={{ marginRight: 8 }} />
                <Text style={s.testPushText}>Send Test Notification to This Device</Text>
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
                <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={s.saveText}>
                  {broadcastPush ? 'Save & Broadcast Push Notification' : 'Save Update Settings'}
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
          <Ionicons name="phone-portrait-outline" size={17} color={C.navy} style={{ marginRight: 8 }} />
          <Text style={s.previewBtnBottomText}>Preview Update Screen</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal for Live Preview */}
      <Modal
        visible={showPreviewModal}
        animationType="slide"
        onRequestClose={() => setShowPreviewModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
          <View style={s.modalCloseBar}>
            <Text style={s.modalCloseTitle}>LIVE PREVIEW</Text>
            <TouchableOpacity
              onPress={() => setShowPreviewModal(false)}
              style={s.modalCloseBtn}
            >
              <Ionicons name="close-circle" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          <UpdateScreen
            currentVersion={installedAppVersion}
            latestVersion={latestAppVersion}
            playStoreUrl={playStoreUrl}
            appStoreUrl={appStoreUrl}
            apkDownloadUrl={apkDownloadUrl}
            message={appUpdateMessage}
            isForced={forceAppUpdate}
            logoUrl={logoUrl}
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
    fontSize: 13,
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
    fontSize: 16,
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
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.goldBorder,
    gap: 4,
  },
  previewHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.gold,
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  heroIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
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
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  heroStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  heroStatLabel: {
    fontSize: 9.5,
    color: '#94A3B8',
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  heroStatValue: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  sectionCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 13.5,
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
    marginBottom: 12,
  },
  label: {
    fontSize: 11.5,
    fontWeight: '700',
    color: C.navyMid,
    marginBottom: 5,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  toggleTitle: {
    fontSize: 12.5,
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
    borderRadius: 10,
    paddingVertical: 11,
    marginTop: 4,
  },
  uploadApkText: {
    fontSize: 12,
    fontWeight: '800',
    color: C.gold,
  },
  presetTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: C.sub,
    marginBottom: 6,
  },
  presetScroll: {
    marginBottom: 12,
  },
  presetChip: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E40AF',
  },
  textArea: {
    minHeight: 90,
    lineHeight: 17,
  },
  actionNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: C.goldLight,
    borderWidth: 1,
    borderColor: C.goldBorder,
    borderRadius: 10,
    padding: 10,
    gap: 8,
    marginBottom: 12,
  },
  actionNoticeText: {
    flex: 1,
    fontSize: 11,
    color: '#92400E',
    lineHeight: 15,
    fontWeight: '600',
  },
  testPushBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.cyanLight,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 10,
    paddingVertical: 10,
  },
  testPushText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: C.cyan,
  },
  saveButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 12,
  },
  saveGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  saveText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  previewBtnBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 12,
    borderRadius: 12,
  },
  previewBtnBottomText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.navy,
  },
  modalCloseBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalCloseTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  modalCloseBtn: {
    padding: 2,
  },
});
