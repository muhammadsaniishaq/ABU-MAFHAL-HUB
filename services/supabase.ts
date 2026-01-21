import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

// Define the custom storage adapter for Expo
import { Platform } from 'react-native';

// Define the custom storage adapter for Expo
const ExpoSecureStoreAdapter = {
    getItem: (key: string) => {
        if (Platform.OS === 'web') {
            if (typeof localStorage === 'undefined') return Promise.resolve(null);
            return Promise.resolve(localStorage.getItem(key));
        }
        return SecureStore.getItemAsync(key);
    },
    setItem: (key: string, value: string) => {
        if (Platform.OS === 'web') {
            if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
            return Promise.resolve();
        }
        return SecureStore.setItemAsync(key, value);
    },
    removeItem: (key: string) => {
        if (Platform.OS === 'web') {
            if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
            return Promise.resolve();
        }
        return SecureStore.deleteItemAsync(key);
    },
};

// Retrieve environment variables (ensure sending .env to EXPO Go or build)
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

// --- LOCAL TESTING TOGGLE ---
// Set this to true to use local Edge Functions (npx supabase functions serve)
const USE_LOCAL_FUNCTIONS = false; 
const LOCAL_FUNCTIONS_URL = Platform.OS === 'android' ? 'http://10.0.2.2:54321/functions/v1' : 'http://localhost:54321/functions/v1';
// ----------------------------

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: ExpoSecureStoreAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

// If local testing is enabled, override the functions URL
if (USE_LOCAL_FUNCTIONS) {
    (supabase as any).functions.url = LOCAL_FUNCTIONS_URL;
}

// Helper to forcefully clear session data (The "Nuclear Option" for stuck sessions)
export const forceSignOut = async () => {
    try {
        await supabase.auth.signOut();
    } catch (e) {
        console.warn("Standard signOut failed, proceeding to manual wipe", e);
    }
    
    // Manual Storage Wipe
    const key = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
    
    if (Platform.OS === 'web') {
        if (typeof localStorage !== 'undefined') {
            localStorage.clear(); // Clear EVERYTHING to be safe
            // Force reload to clear memory state
            window.location.href = '/'; 
            return;
        }
    } else {
        await SecureStore.deleteItemAsync(key);
        await SecureStore.deleteItemAsync('supabase.auth.token');
    }
};
