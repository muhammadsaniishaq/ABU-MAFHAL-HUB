import { supabase } from './supabase';

/**
 * In-memory / dynamic cache for LiveKit configuration fetched from API Vault (system_secrets)
 */
let cachedLiveKitConfig: { wsUrl: string; apiKey: string; apiSecret: string } | null = null;
let lastFetchTime = 0;

/**
 * Retrieve LiveKit Credentials securely from the API Vault (public.system_secrets / app_settings)
 */
export async function getLiveKitCredentials(): Promise<{ wsUrl: string; apiKey: string; apiSecret: string }> {
  const now = Date.now();
  if (cachedLiveKitConfig && (now - lastFetchTime < 60000)) {
    return cachedLiveKitConfig;
  }

  let wsUrl = process.env.EXPO_PUBLIC_LIVEKIT_URL || '';
  let apiKey = process.env.EXPO_PUBLIC_LIVEKIT_API_KEY || '';
  let apiSecret = process.env.EXPO_PUBLIC_LIVEKIT_API_SECRET || '';

  try {
    const { data: secrets } = await supabase
      .from('system_secrets')
      .select('key, value')
      .in('key', ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET']);

    if (secrets && secrets.length > 0) {
      secrets.forEach(s => {
        if (s.key === 'LIVEKIT_URL' && s.value) wsUrl = s.value.trim();
        if (s.key === 'LIVEKIT_API_KEY' && s.value) apiKey = s.value.trim();
        if (s.key === 'LIVEKIT_API_SECRET' && s.value) apiSecret = s.value.trim();
      });
    }

    if (!wsUrl || !apiKey || !apiSecret) {
      const { data: settings } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['livekit_url', 'livekit_api_key', 'livekit_api_secret', 'LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET']);

      if (settings && settings.length > 0) {
        settings.forEach(s => {
          const k = s.key.toLowerCase();
          if (k.includes('url') && s.value && !wsUrl) wsUrl = s.value.trim();
          if (k.includes('key') && s.value && !apiKey) apiKey = s.value.trim();
          if (k.includes('secret') && s.value && !apiSecret) apiSecret = s.value.trim();
        });
      }
    }
  } catch (err) {
    console.warn('LiveKit credentials vault fetch note:', err);
  }

  if (wsUrl && !wsUrl.startsWith('wss://') && !wsUrl.startsWith('ws://')) {
    wsUrl = `wss://${wsUrl}`;
  }

  cachedLiveKitConfig = { wsUrl, apiKey, apiSecret };
  lastFetchTime = now;
  return cachedLiveKitConfig;
}

/**
 * Generate LiveKit token placeholder
 */
export async function createLiveKitRoomToken(
  roomName: string,
  participantName: string,
  participantId?: string
): Promise<string> {
  return '';
}

/**
 * Build LiveKit Meet web URL
 */
export function buildLiveKitMeetUrl(token: string, wsUrl?: string): string {
  const finalWs = wsUrl || cachedLiveKitConfig?.wsUrl || '';
  const encodedWs = encodeURIComponent(finalWs);
  const encodedToken = encodeURIComponent(token);
  return `https://meet.livekit.io/custom?liveKitUrl=${encodedWs}&token=${encodedToken}`;
}
