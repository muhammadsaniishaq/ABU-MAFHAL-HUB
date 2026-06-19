import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Custom Storage Adapter using AsyncStorage (No 2KB limit like SecureStore)
// SSR Safe wrapper to prevent "window is not defined" during build
const AsyncStorageAdapter = {
    getItem: (key: string) => {
        if (typeof window === 'undefined') return Promise.resolve(null);
        return AsyncStorage.getItem(key);
    },
    setItem: (key: string, value: string) => {
        if (typeof window === 'undefined') return Promise.resolve();
        return AsyncStorage.setItem(key, value);
    },
    removeItem: (key: string) => {
        if (typeof window === 'undefined') return Promise.resolve();
        return AsyncStorage.removeItem(key);
    },
};

// Retrieve environment variables (ensure sending .env to EXPO Go or build)
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

// --- LOCAL TESTING TOGGLE ---
const USE_LOCAL_FUNCTIONS = false; 
const LOCAL_FUNCTIONS_URL = Platform.OS === 'android' ? 'http://10.0.2.2:54321/functions/v1' : 'http://localhost:54321/functions/v1';
// ----------------------------

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: AsyncStorageAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

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
    
    // Clear AsyncStorage for both Web and Native
    try {
        await AsyncStorage.clear();
    } catch(e) {
        console.error("AsyncStorage clear failed", e);
    }

    if (Platform.OS === 'web') {
        if (typeof localStorage !== 'undefined') {
            localStorage.clear();
            // window.location.href = '/'; // Disable full reload, let Router handle it
        }
    }
};
