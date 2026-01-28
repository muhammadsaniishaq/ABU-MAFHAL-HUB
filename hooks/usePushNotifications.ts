import { useState, useEffect, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from '../services/supabase';

export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>('');
  const [notification, setNotification] = useState<any>(undefined);
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;
    let Notifications: any;

    const isExpoGo = Constants.executionEnvironment === 'storeClient';

    // 1. Setup Notifications Module (Safe for Expo Go now)
    try {
        Notifications = require('expo-notifications');
        
        // Configure Handler immediately
        Notifications.setNotificationHandler({
            handleNotification: async () => ({
                shouldShowAlert: true,
                shouldPlaySound: true,
                shouldSetBadge: false,
            }),
        });
    } catch (e) {
        console.error("Failed to load expo-notifications module:", e);
    }

    // 2. Register for Token (SKIP IN EXPO GO)
    const registerForPushNotificationsAsync = async () => {
        if (isExpoGo || !Notifications) return null;

        let token;
        
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        }

        if (Device.isDevice && !isExpoGo) {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;
            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }
            if (finalStatus !== 'granted') {
                console.log('Failed to get push token for push notification!');
                return;
            }
            
            try {
                const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
                token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
                console.log("Push Token:", token);
            } catch (e: any) {
                console.log("Remote Push Token Error:", e.message);
            }
        } else {
            console.log("Not a physical device, skipping push registration");
        }

        return token;
    };

    // Run Registration
    registerForPushNotificationsAsync().then(async (token) => {
        if (isMounted) setExpoPushToken(token);
        if (token && isMounted) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase.from('profiles').update({ expo_push_token: token }).eq('id', user.id);
            }
        }
    });

    // 3. Setup Realtime Listener (THE WORKAROUND)
    let cleanupRealtime: (() => void) | undefined;
    
    const setupRealtime = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const channel = supabase
            .channel('notifications-listener')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`,
                },
                async (payload) => {
                    console.log("New Notification received via Realtime:", payload.new);
                    const { title, body, data } = payload.new;
                    
                    if (Notifications) {
                        try {
                            await Notifications.scheduleNotificationAsync({
                                content: {
                                    title: title,
                                    body: body,
                                    sound: 'default',
                                    data: data || {},
                                },
                                trigger: null,
                            });
                        } catch (e) {
                             console.error("Local Notification Schedule Failed:", e);
                        }
                    } else {
                        // Expo Go Fallback: Just show an Alert (SAFE)
                        // console.log("Showing Alert fallback for Expo Go");
                        Alert.alert(title || "New Notification", body);
                    }
                }
            )
            .subscribe();

        return () => {
             supabase.removeChannel(channel);
        };
    };

    setupRealtime().then(cleanup => { 
        if (isMounted) cleanupRealtime = cleanup; 
    });

    // 4. Native Listeners (Only if available)
    if (Notifications && !isExpoGo) {
        notificationListener.current = Notifications.addNotificationReceivedListener((notification: any) => {
            if (isMounted) setNotification(notification);
        });

        responseListener.current = Notifications.addNotificationResponseReceivedListener((response: any) => {
            console.log(response);
        });
    }

    return () => {
        isMounted = false;
        if (Notifications && !isExpoGo) {
            Notifications.removeNotificationSubscription(notificationListener.current);
            Notifications.removeNotificationSubscription(responseListener.current);
        }
        if (cleanupRealtime) cleanupRealtime();
    };
  }, []);

  return { expoPushToken, notification };
}
