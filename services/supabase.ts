import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// Fallback to active production project defaults
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://uagcxrtdqttayulvgpwg.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZ2N4cnRkcXR0YXl1bHZncHdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2Mzc3OTIsImV4cCI6MjA4NDIxMzc5Mn0.7AzXKou9G3tHFIduDL5TQ3fkski6P9CBGdlqfi_pMI8';

const isWeb = Platform.OS === 'web';

// Custom Storage adapter for Expo / React Native Web
const customStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (isWeb && typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return await AsyncStorage.getItem(key);
    } catch (e) {
      console.warn('Storage getItem error:', e);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (isWeb && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      } else {
        await AsyncStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn('Storage setItem error:', e);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      if (isWeb && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      } else {
        await AsyncStorage.removeItem(key);
      }
    } catch (e) {
      console.warn('Storage removeItem error:', e);
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: customStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: isWeb,
  },
});

/**
 * Processes OAuth return tokens or authorization codes from the URL on web.
 * Supports both hash fragment tokens (#access_token=...) and query parameters (?code=...).
 */
export async function processOAuthReturn(): Promise<boolean> {
  if (!isWeb || typeof window === 'undefined') return false;

  try {
    const url = new URL(window.location.href);

    // 1. Check for authorization code in search params (?code=...)
    const code = url.searchParams.get('code');
    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error && data?.session) {
        // Clean URL params without reloading
        window.history.replaceState({}, document.title, window.location.pathname);
        return true;
      }
    }

    // 2. Check for access_token / refresh_token in hash fragment (#access_token=...)
    if (window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');

      if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (!error && data?.session) {
          // Clean hash from URL without reloading
          window.history.replaceState({}, document.title, window.location.pathname);
          return true;
        }
      }
    }

    // 3. Fallback check for existing active session
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
  } catch (e) {
    console.warn('processOAuthReturn error:', e);
    return false;
  }
}

/**
 * Force signs out the user and purges all cached authentication tokens.
 */
export async function forceSignOut(): Promise<void> {
  try {
    await supabase.auth.signOut();
    if (isWeb && typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('user_transaction_pin');
      window.localStorage.removeItem('saved_user_pin');
    }
    await AsyncStorage.removeItem('user_transaction_pin');
    await AsyncStorage.removeItem('saved_user_pin');
  } catch (e) {
    console.warn('forceSignOut error:', e);
  }
}
