import { useState, useEffect, useRef } from 'react';
import { Platform, Alert, Linking } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import { useRouter } from 'expo-router';

// Audio Catalog URLs for all devices and notifications (hosted on official domain + GitHub CDN fallback)
export const GLOBAL_RINGTONES: Record<string, string> = {
  executive_bell: 'https://abumafhal.com.ng/sounds/executive_bell.wav',
  siren_alert: 'https://abumafhal.com.ng/sounds/siren_alert.wav',
  cash_register: 'https://abumafhal.com.ng/sounds/cash_register.wav',
  military_horn: 'https://abumafhal.com.ng/sounds/military_horn.wav',
  radar_ping: 'https://abumafhal.com.ng/sounds/radar_ping.wav',
  subtle_chime: 'https://abumafhal.com.ng/sounds/subtle_chime.wav',
};

export interface GlobalNotificationTune {
  id: string;
  uri: string;
  name: string;
}

// In-memory cache for instant zero-latency playback across all screens and notifications
let cachedGlobalTune: GlobalNotificationTune | null = null;
let activeSoundInstance: Audio.Sound | null = null;
let activeWebAudioInstance: any = null;

/**
 * Synchronize the latest Global Notification Ringtone from Supabase app_settings & AsyncStorage
 */
export async function syncGlobalNotificationRingtone(): Promise<GlobalNotificationTune | null> {
  try {
    // 1. Try reading from database (source of truth)
    const { data: dbTone } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'global_notification_ringtone')
      .maybeSingle();

    if (dbTone?.value) {
      let parsed: any = dbTone.value;
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch (_) {}
      }

      if (parsed && typeof parsed === 'object' && parsed.uri) {
        cachedGlobalTune = {
          id: String(parsed.id || 'custom'),
          uri: String(parsed.uri).trim(),
          name: String(parsed.name || 'Custom Tune').trim()
        };
        await AsyncStorage.setItem('global_notification_ringtone', JSON.stringify(cachedGlobalTune));
        return cachedGlobalTune;
      } else if (typeof parsed === 'string') {
        const trimmed = parsed.trim();
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
          cachedGlobalTune = { id: 'custom', uri: trimmed, name: 'Cloud Custom Tune' };
          await AsyncStorage.setItem('global_notification_ringtone', JSON.stringify(cachedGlobalTune));
          return cachedGlobalTune;
        } else if (GLOBAL_RINGTONES[trimmed]) {
          cachedGlobalTune = { id: trimmed, uri: GLOBAL_RINGTONES[trimmed], name: trimmed.replace(/_/g, ' ') };
          await AsyncStorage.setItem('global_notification_ringtone', JSON.stringify(cachedGlobalTune));
          return cachedGlobalTune;
        }
      }
    }

    // 2. Fallback to AsyncStorage cache
    const stored = await AsyncStorage.getItem('global_notification_ringtone');
    if (stored) {
      if (stored.startsWith('{')) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed?.uri) {
            cachedGlobalTune = {
              id: parsed.id || 'custom',
              uri: parsed.uri,
              name: parsed.name || 'Notification Tune'
            };
            return cachedGlobalTune;
          }
        } catch (_) {}
      } else if (stored.startsWith('http://') || stored.startsWith('https://')) {
        cachedGlobalTune = { id: 'custom', uri: stored, name: 'Custom Tune' };
        return cachedGlobalTune;
      } else if (GLOBAL_RINGTONES[stored]) {
        cachedGlobalTune = { id: stored, uri: GLOBAL_RINGTONES[stored], name: stored.replace(/_/g, ' ') };
        return cachedGlobalTune;
      }
    }

    // 3. Ultimate default
    cachedGlobalTune = {
      id: 'executive_bell',
      uri: GLOBAL_RINGTONES['executive_bell'],
      name: 'Executive Crystal Bell'
    };
    return cachedGlobalTune;
  } catch (err) {
    console.warn('[PushSound] syncGlobalNotificationRingtone note:', err);
    if (!cachedGlobalTune) {
      cachedGlobalTune = {
        id: 'executive_bell',
        uri: GLOBAL_RINGTONES['executive_bell'],
        name: 'Executive Crystal Bell'
      };
    }
    return cachedGlobalTune;
  }
}

/**
 * Returns current global notification tune (with automatic lazy initialization)
 */
export async function getGlobalNotificationTune(): Promise<GlobalNotificationTune> {
  if (cachedGlobalTune && cachedGlobalTune.uri) {
    return cachedGlobalTune;
  }
  const loaded = await syncGlobalNotificationRingtone();
  return loaded || {
    id: 'executive_bell',
    uri: GLOBAL_RINGTONES['executive_bell'],
    name: 'Executive Crystal Bell'
  };
}

/**
 * Bulletproof, zero-crash Audio player for incoming notifications
 * Ensures seamless playback on both Android, iOS and Web without resource leaks
 */
export async function playDeviceAlertSound(toneKeyOrUri?: string) {
  try {
    // Check if user has muted sound in preferences
    const isMuted = await AsyncStorage.getItem('user_notifications_muted');
    if (isMuted === 'true') {
      return;
    }

    let targetUri = '';

    // 1. Direct HTTP(S) URL
    if (toneKeyOrUri && (toneKeyOrUri.startsWith('http://') || toneKeyOrUri.startsWith('https://'))) {
      targetUri = toneKeyOrUri;
    } 
    // 2. Specific built-in key override if valid
    else if (toneKeyOrUri && GLOBAL_RINGTONES[toneKeyOrUri]) {
      targetUri = GLOBAL_RINGTONES[toneKeyOrUri];
    } 
    // 3. Cached active global tune
    else if (cachedGlobalTune?.uri) {
      targetUri = cachedGlobalTune.uri;
    }

    // 4. Fallback lookup if cache is not yet warm
    if (!targetUri) {
      const activeTune = await getGlobalNotificationTune();
      targetUri = activeTune.uri;
    }

    if (!targetUri) {
      targetUri = GLOBAL_RINGTONES['executive_bell'];
    }

    // --- Web Audio Playback ---
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && (window as any).Audio) {
          if (activeWebAudioInstance) {
            try {
              activeWebAudioInstance.pause();
              activeWebAudioInstance = null;
            } catch (_) {}
          }
          const webAudio = new (window as any).Audio(targetUri);
          webAudio.volume = 1.0;
          activeWebAudioInstance = webAudio;
          webAudio.onended = () => {
            if (activeWebAudioInstance === webAudio) activeWebAudioInstance = null;
          };
          webAudio.play().catch((e: any) => {
            console.log('[PushSound] Web Audio blocked or error:', e);
          });
          return;
        }
      } catch (_) {}
    }

    // --- Native Mobile Playback (Android / iOS) ---
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    }).catch(() => {});

    // Safely unload any playing sound to prevent concurrent stream crashes / memory exhaustion
    if (activeSoundInstance) {
      try {
        await activeSoundInstance.stopAsync();
        await activeSoundInstance.unloadAsync();
      } catch (_) {}
      activeSoundInstance = null;
    }

    const { sound } = await Audio.Sound.createAsync(
      { uri: targetUri },
      { shouldPlay: true, volume: 1.0 }
    );
    activeSoundInstance = sound;

    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && !status.isPlaying && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
        if (activeSoundInstance === sound) {
          activeSoundInstance = null;
        }
      }
    });
  } catch (err) {
    console.log('[PushSound] Audio playback note (handled):', err);
  }
}

let NotificationsModule: any = null;

// Safely require expo-notifications
try {
  if (Platform.OS !== 'web') {
    NotificationsModule = require('expo-notifications');
    if (NotificationsModule && NotificationsModule.setNotificationHandler) {
      NotificationsModule.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true, // Guarantees native sound alerts even when app is closed / in background
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
          priority: NotificationsModule.AndroidNotificationPriority?.MAX || 5,
        }),
      });
    }
  }
} catch (e) {
  console.warn('[Push] Error initializing NotificationsModule:', e);
}

/**
 * Configure Android Notification Channels with MAX importance, sound, and vibration
 */
export async function setupChannels() {
  if (Platform.OS === 'android' && NotificationsModule?.setNotificationChannelAsync) {
    try {
      // Channel 1: Transactions & Wallet (High Priority, Sound, Vibration, Heads-up banner)
      await NotificationsModule.setNotificationChannelAsync('transactions', {
        name: 'Transactions & Wallet',
        importance: NotificationsModule.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#f5a623',
        sound: 'default',
        enableLights: true,
        enableVibrate: true,
        showBadge: true,
        lockscreenVisibility: NotificationsModule.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
      });

      // Channel 2: Updates & Announcements (High Priority, Banner, Sound)
      await NotificationsModule.setNotificationChannelAsync('updates', {
        name: 'Updates & Announcements',
        importance: NotificationsModule.AndroidImportance.MAX,
        vibrationPattern: [0, 200, 200],
        lightColor: '#0056D2',
        sound: 'default',
        enableLights: true,
        enableVibrate: true,
        showBadge: true,
        lockscreenVisibility: NotificationsModule.AndroidNotificationVisibility.PUBLIC,
      });

      // Channel 3: Default / General Alerts
      await NotificationsModule.setNotificationChannelAsync('default', {
        name: 'General Alerts',
        importance: NotificationsModule.AndroidImportance.MAX,
        vibrationPattern: [0, 200, 200],
        lightColor: '#0056D2',
        sound: 'default',
        enableLights: true,
        enableVibrate: true,
        showBadge: true,
        lockscreenVisibility: NotificationsModule.AndroidNotificationVisibility.PUBLIC,
      });

      // Channel 4: Security & Auth
      await NotificationsModule.setNotificationChannelAsync('security', {
        name: 'Security & Auth',
        importance: NotificationsModule.AndroidImportance.MAX,
        vibrationPattern: [0, 300, 150, 300],
        lightColor: '#dc2626',
        sound: 'default',
        enableLights: true,
        enableVibrate: true,
        showBadge: true,
        lockscreenVisibility: NotificationsModule.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
      });
    } catch (err) {
      console.warn('[Push] Channel setup note:', err);
    }
  }
}

/**
 * Trigger an instant local push notification with sound, vibration, and status-bar drop down
 */
export async function sendInstantNotification(
  title: string,
  body: string,
  data: Record<string, any> = {},
  channelId: string = 'transactions'
) {
  if (!NotificationsModule || Platform.OS === 'web') {
    console.log(`[Notification Fallback] ${title}: ${body}`);
    return;
  }

  try {
    await setupChannels();

    const selectedChannel = channelId || 'transactions';
    await NotificationsModule.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        channelId: selectedChannel,
        priority: NotificationsModule.AndroidNotificationPriority?.MAX || 'max',
        vibrate: [0, 250, 250, 250],
        data,
      },
      trigger: null, // triggers instantly
    });

    // Play configured ringtone audio chime on device
    await playDeviceAlertSound(data?.ringtone);
    console.log(`[Push] Instant notification dispatched to ${selectedChannel} channel: ${title}`);
  } catch (err) {
    console.warn('[Notification] Failed to dispatch instant notification:', err);
  }
}

export function usePushNotifications() {
  const router = useRouter();
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>('');
  const [notification, setNotification] = useState<any>(undefined);
  const tokenRef = useRef<string | undefined>('');
  const channelRef = useRef<any>(null);
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;
    const isExpoGo = Constants.executionEnvironment === 'storeClient';

    // Immediate channel initialization
    setupChannels();

    const registerForPushNotificationsAsync = async () => {
      if (Platform.OS === 'web' || !NotificationsModule) return null;

      await setupChannels();

      let token: string | undefined;

      try {
        const { status: existingStatus } = await NotificationsModule.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await NotificationsModule.requestPermissionsAsync({
            ios: {
              allowAlert: true,
              allowBadge: true,
              allowSound: true,
              allowAnnounce: true,
            },
          });
          finalStatus = status;
        }

        if (finalStatus !== 'granted') {
          console.log('[Push] Notification permission not granted');
          return null;
        }

        // Attempt to get token on all native devices
        try {
          const projectId =
            Constants?.expoConfig?.extra?.eas?.projectId ??
            Constants?.easConfig?.projectId ??
            '1f7dcc60-7e1a-4263-b1d9-47489c243d34';

          const tokenResult = await NotificationsModule.getExpoPushTokenAsync({ projectId });
          token = tokenResult?.data;
          console.log('[Push] Registered Token successfully:', token);
        } catch (innerTokErr: any) {
          try {
            // Fallback without explicit projectId if EAS config has it embedded
            const tokenResult = await NotificationsModule.getExpoPushTokenAsync();
            token = tokenResult?.data;
            console.log('[Push] Registered Token (fallback) successfully:', token);
          } catch (tokErr2: any) {
            console.log('[Push] Expo push token registration note:', tokErr2?.message || tokErr2);
          }
        }
      } catch (e: any) {
        console.warn('[Push] Push registration note:', e?.message || e);
      }

      return token;
    };

    // Save token to Supabase profile
    const saveTokenToProfile = async (token: string, targetUserId?: string) => {
      try {
        let userId = targetUserId;
        if (!userId) {
          const { data: { user } } = await supabase.auth.getUser();
          userId = user?.id;
        }

        if (userId && token) {
          await supabase
            .from('profiles')
            .update({ expo_push_token: token, updated_at: new Date().toISOString() })
            .eq('id', userId);
          console.log('[Push] Token successfully saved to profile for user:', userId);
        }
      } catch (e) {
        console.warn('[Push] Error saving token to profile:', e);
      }
    };

    // Realtime Supabase notifications listener for instant push
    const setupRealtime = async (targetUserId?: string) => {
      try {
        let userId = targetUserId;
        if (!userId) {
          const { data: { user } } = await supabase.auth.getUser();
          userId = user?.id;
        }
        if (!userId) return;

        // If already subscribed to a channel, remove it first
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }

        const channel = supabase
          .channel(`user-notifications-${userId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${userId}`,
            },
            async (payload) => {
              const { title, body, data, type } = payload.new || {};
              if (title || body) {
                const notifType = type || data?.type;
                let targetChannel: 'transactions' | 'updates' | 'security' = 'updates';
                if (notifType === 'security' || data?.priority === 'high') {
                  targetChannel = 'security';
                } else if (
                  notifType === 'wallet_credit' || 
                  notifType === 'wallet_debit' || 
                  notifType === 'funding' || 
                  notifType === 'transaction'
                ) {
                  targetChannel = 'transactions';
                }

                await sendInstantNotification(
                  title || 'Abu Mafhal Sub',
                  body || 'You have a new update.',
                  data || {},
                  targetChannel
                );
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'transactions',
              filter: `user_id=eq.${userId}`,
            },
            async (payload) => {
              const tr = payload.new || {};
              const rawType = (tr.service_type || tr.type || 'Transaction').toLowerCase();
              const isFunding = rawType.includes('fund') || rawType.includes('credit') || rawType.includes('deposit') || rawType.includes('topup');
              const amt = tr.amount ? `₦${Number(tr.amount).toLocaleString()}` : '';
              const status = tr.status || 'Completed';
              
              let title = `⚡ ${rawType.toUpperCase()} ${status}`;
              let body = `Your ${rawType} transaction for ${amt} has been processed (${status}).`;

              if (isFunding) {
                title = `💰 Wallet Credited Successfully!`;
                body = `Your Abu Mafhal wallet has been credited with ${amt}. Status: ${status}.`;
              }

              await sendInstantNotification(
                title,
                body,
                { 
                  route: '/(app)/history', 
                  transaction_id: tr.id, 
                  is_funding: isFunding,
                  // Do not force ringtone override so the global notification tune is used
                },
                'transactions'
              );
            }
          )
          .subscribe();

        channelRef.current = channel;
      } catch (err) {
        console.warn('[Push] Realtime setup note:', err);
      }
    };

    // Pre-load & synchronize global notification ringtone
    syncGlobalNotificationRingtone();

    // Realtime Global Notification Tune Listener (Syncs changes made by admin instantly to all active devices)
    const tuneChannel = supabase
      .channel('global-notification-tune-listener')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_settings',
          filter: 'key=eq.global_notification_ringtone',
        },
        (payload) => {
          const newRow = payload.new as any;
          if (newRow?.value) {
            let parsed: any = newRow.value;
            if (typeof parsed === 'string') {
              try { parsed = JSON.parse(parsed); } catch (_) {}
            }
            if (parsed && typeof parsed === 'object' && parsed.uri) {
              cachedGlobalTune = {
                id: String(parsed.id || 'custom'),
                uri: String(parsed.uri).trim(),
                name: String(parsed.name || 'Notification Tune').trim()
              };
              AsyncStorage.setItem('global_notification_ringtone', JSON.stringify(cachedGlobalTune)).catch(() => {});
              console.log('[PushSound] Realtime synchronized global notification tune:', cachedGlobalTune.name);
            }
          }
        }
      )
      .subscribe();

    // Initial Registration
    registerForPushNotificationsAsync().then((token) => {
      if (isMounted && token) {
        setExpoPushToken(token);
        tokenRef.current = token;
        saveTokenToProfile(token);
      }
    });

    // Try initial realtime setup if user is already authenticated
    setupRealtime();

    // Listen for Auth changes so token and Realtime are configured immediately on login
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          if (tokenRef.current) {
            await saveTokenToProfile(tokenRef.current, session.user.id);
          }
          setupRealtime(session.user.id);
        } else {
          if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
          }
        }
      }
    );

    // Native Notification Listeners
    if (NotificationsModule && !isExpoGo) {
      notificationListener.current = NotificationsModule.addNotificationReceivedListener(
        async (notif: any) => {
          if (isMounted) setNotification(notif);
          // Play the custom ringtone on any incoming remote push notification
          const pushData = notif?.request?.content?.data;
          await playDeviceAlertSound(pushData?.ringtone);
        }
      );

      responseListener.current = NotificationsModule.addNotificationResponseReceivedListener(
        async (response: any) => {
          const data = response?.notification?.request?.content?.data;
          const url =
            data?.url ||
            (typeof data?.route === 'string' &&
            (data.route.startsWith('http://') ||
              data.route.startsWith('https://') ||
              data.route.startsWith('market://'))
              ? data.route
              : null);

          if (url) {
            try {
              if (Platform.OS === 'android' && url.includes('play.google.com/store/apps/details?id=')) {
                const pkg = url.split('id=')[1]?.split('&')[0];
                if (pkg) {
                  const marketUri = `market://details?id=${pkg}`;
                  const canOpen = await Linking.canOpenURL(marketUri);
                  if (canOpen) {
                    await Linking.openURL(marketUri);
                    return;
                  }
                }
              }
              await Linking.openURL(url);
              return;
            } catch (err) {
              console.warn('[Push] Error opening URL from notification tap:', err);
            }
          }

          const route = data?.route;
          if (route) {
            router.push(route);
          }
        }
      );
    }

    return () => {
      isMounted = false;
      authSubscription.unsubscribe();
      if (tuneChannel) {
        supabase.removeChannel(tuneChannel);
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (NotificationsModule && !isExpoGo) {
        if (notificationListener.current?.remove) notificationListener.current.remove();
        if (responseListener.current?.remove) responseListener.current.remove();
      }
    };
  }, []);

  return { expoPushToken, notification };
}

