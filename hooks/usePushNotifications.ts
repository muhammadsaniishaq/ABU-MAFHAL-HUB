import { useState, useEffect, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from '../services/supabase';
import { useRouter } from 'expo-router';

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
          priority: NotificationsModule.AndroidNotificationPriority?.MAX || 5,
        }),
      });
    }
  }
} catch (e) {
  console.warn('[Push] Error initializing NotificationsModule:', e);
}

/**
 * Trigger an instant local push notification with sound and vibration
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
    await NotificationsModule.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        priority: NotificationsModule.AndroidNotificationPriority?.MAX || 'max',
        data,
      },
      trigger: null, // triggers instantly
    });
  } catch (err) {
    console.warn('[Notification] Failed to dispatch instant notification:', err);
  }
}

export function usePushNotifications() {
  const router = useRouter();
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>('');
  const [notification, setNotification] = useState<any>(undefined);
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;
    const isExpoGo = Constants.executionEnvironment === 'storeClient';

    const setupChannels = async () => {
      if (Platform.OS === 'android' && NotificationsModule?.setNotificationChannelAsync) {
        try {
          // Channel 1: Transactions & Wallet (High Priority, Sound, Vibration)
          await NotificationsModule.setNotificationChannelAsync('transactions', {
            name: 'Transactions & Wallet',
            importance: NotificationsModule.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#f5a623',
            sound: 'default',
            enableLights: true,
            enableVibrate: true,
            showBadge: true,
          });

          // Channel 2: Default System Channel
          await NotificationsModule.setNotificationChannelAsync('default', {
            name: 'General Alerts',
            importance: NotificationsModule.AndroidImportance.HIGH,
            vibrationPattern: [0, 200, 200],
            lightColor: '#0056D2',
            sound: 'default',
            enableLights: true,
            enableVibrate: true,
            showBadge: true,
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
          });
        } catch (err) {
          console.warn('[Push] Channel setup note:', err);
        }
      }
    };

    const registerForPushNotificationsAsync = async () => {
      if (Platform.OS === 'web' || !NotificationsModule) return null;

      await setupChannels();

      let token: string | undefined;

      try {
        if (Device.isDevice) {
          const { status: existingStatus } = await NotificationsModule.getPermissionsAsync();
          let finalStatus = existingStatus;
          if (existingStatus !== 'granted') {
            const { status } = await NotificationsModule.requestPermissionsAsync();
            finalStatus = status;
          }

          if (finalStatus !== 'granted') {
            console.log('[Push] Notification permission not granted');
            return null;
          }

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
    const saveTokenToProfile = async (token: string) => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && token) {
          await supabase
            .from('profiles')
            .update({ expo_push_token: token, updated_at: new Date().toISOString() })
            .eq('id', user.id);
        }
      } catch (e) {
        console.warn('[Push] Error saving token to profile:', e);
      }
    };

    registerForPushNotificationsAsync().then((token) => {
      if (isMounted && token) {
        setExpoPushToken(token);
        saveTokenToProfile(token);
      }
    });

    // Realtime Supabase notifications listener for instant push
    let channel: any = null;
    const setupRealtime = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        channel = supabase
          .channel(`user-notifications-${user.id}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${user.id}`,
            },
            async (payload) => {
              const { title, body, data } = payload.new || {};
              if (title || body) {
                await sendInstantNotification(
                  title || 'Abu Mafhal Sub',
                  body || 'You have a new update.',
                  data || {},
                  'transactions'
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
              filter: `user_id=eq.${user.id}`,
            },
            async (payload) => {
              const tr = payload.new || {};
              const type = tr.service_type || tr.type || 'Transaction';
              const amt = tr.amount ? `₦${Number(tr.amount).toLocaleString()}` : '';
              const status = tr.status || 'Completed';
              const title = `⚡ ${type.toUpperCase()} ${status}`;
              const body = `Your ${type} transaction for ${amt} has been processed (${status}).`;

              await sendInstantNotification(
                title,
                body,
                { route: '/(app)/history', transaction_id: tr.id },
                'transactions'
              );
            }
          )
          .subscribe();
      } catch (err) {
        console.warn('[Push] Realtime setup note:', err);
      }
    };

    setupRealtime();

    // Native Notification Listeners
    if (NotificationsModule && !isExpoGo) {
      notificationListener.current = NotificationsModule.addNotificationReceivedListener(
        (notif: any) => {
          if (isMounted) setNotification(notif);
        }
      );

      responseListener.current = NotificationsModule.addNotificationResponseReceivedListener(
        (response: any) => {
          const route = response?.notification?.request?.content?.data?.route;
          if (route) {
            router.push(route);
          }
        }
      );
    }

    return () => {
      isMounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
      if (NotificationsModule && !isExpoGo) {
        if (notificationListener.current?.remove) notificationListener.current.remove();
        if (responseListener.current?.remove) responseListener.current.remove();
      }
    };
  }, []);

  return { expoPushToken, notification };
}
