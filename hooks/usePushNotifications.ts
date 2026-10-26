import { useState, useEffect, useRef } from 'react';
import { Platform, Alert, Linking } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import { useRouter } from 'expo-router';

// Audio Catalog URLs for all devices and notifications
export const GLOBAL_RINGTONES: Record<string, string> = {
  executive_bell: 'https://cdn.freesound.org/previews/264/264981_4486188-lq.mp3',
  siren_alert: 'https://cdn.freesound.org/previews/456/456544_5121236-lq.mp3',
  cash_register: 'https://cdn.freesound.org/previews/333/333404_4684427-lq.mp3',
  military_horn: 'https://cdn.freesound.org/previews/387/387232_1474204-lq.mp3',
  radar_ping: 'https://cdn.freesound.org/previews/320/320655_5260872-lq.mp3',
  subtle_chime: 'https://cdn.freesound.org/previews/352/352661_4019029-lq.mp3',
};

// Play ringtone on the device using Audio.Sound (supports predefined key or direct URL)
export async function playDeviceAlertSound(toneKeyOrUri?: string) {
  try {
    let sourceUri = '';

    if (toneKeyOrUri && (toneKeyOrUri.startsWith('http://') || toneKeyOrUri.startsWith('https://') || toneKeyOrUri.startsWith('file://'))) {
      sourceUri = toneKeyOrUri;
    } else {
      let key = toneKeyOrUri;
      if (!key) {
        key = await AsyncStorage.getItem('global_notification_ringtone') || 'executive_bell';
      }
      // Check if key is itself a stored custom URI
      if (key && (key.startsWith('http://') || key.startsWith('https://') || key.startsWith('file://'))) {
        sourceUri = key;
      } else {
        sourceUri = GLOBAL_RINGTONES[key || 'executive_bell'] || GLOBAL_RINGTONES['executive_bell'];
      }
    }

    if (sourceUri) {
      if (Platform.OS !== 'web') {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        }).catch(() => {});
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: sourceUri },
        { shouldPlay: true, volume: 1.0 }
      );
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && !status.isPlaying && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
        }
      });
    }
  } catch (err) {
    console.log('[PushSound] Audio playback error:', err);
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
          shouldPlaySound: true,
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

      // Channel 2: Default / General Alerts
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

      // Channel 3: Security & Auth
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

        if (Device.isDevice) {
          const projectId =
            Constants?.expoConfig?.extra?.eas?.projectId ??
            Constants?.easConfig?.projectId ??
            '1f7dcc60-7e1a-4263-b1d9-47489c243d34';

          const tokenResult = await NotificationsModule.getExpoPushTokenAsync({ projectId });
          token = tokenResult?.data;
          console.log('[Push] Registered Token successfully:', token);
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
                  ringtone: isFunding ? 'cash_register' : 'subtle_chime'
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
        (notif: any) => {
          if (isMounted) setNotification(notif);
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

