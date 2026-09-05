import { Platform } from 'react-native';
import { supabase, supabaseUrl, supabaseAnonKey } from './supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

export interface UploadMediaOptions {
  uri: string;
  bucket?: string;
  folder?: string;
  fileName?: string;
  mimeType?: string;
  base64?: string | null;
  isVideo?: boolean;
}

export interface UploadMediaResult {
  success: boolean;
  publicUrl: string;
  error?: string;
}

/**
 * Crash-free, memory-efficient media upload to Supabase Storage.
 * On Native, streams files directly from disk via FileSystem.uploadAsync
 * to avoid JS Heap Out-Of-Memory (OOM) crashes on large videos and photos.
 */
export async function uploadMediaFile(options: UploadMediaOptions): Promise<UploadMediaResult> {
  const {
    uri,
    bucket = 'banners',
    folder = 'announcements',
    mimeType = 'image/jpeg',
    base64 = null,
    isVideo = false,
  } = options;

  const ext = (uri.split('.').pop() || (isVideo ? 'mp4' : 'jpg')).split('?')[0];
  const finalFileName = options.fileName || `${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

  // 1. Web Environment: standard blob upload
  if (Platform.OS === 'web') {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(finalFileName, blob, { contentType: mimeType, upsert: true });

      if (uploadError) {
        // Fallback to 'avatars' bucket
        const { error: fallbackError } = await supabase.storage
          .from('avatars')
          .upload(finalFileName, blob, { contentType: mimeType, upsert: true });
        if (fallbackError) throw fallbackError;
        const { data } = supabase.storage.from('avatars').getPublicUrl(finalFileName);
        return { success: true, publicUrl: data.publicUrl };
      }

      const { data } = supabase.storage.from(bucket).getPublicUrl(finalFileName);
      return { success: true, publicUrl: data.publicUrl };
    } catch (err: any) {
      return { success: false, publicUrl: '', error: err.message || 'Web upload failed' };
    }
  }

  // 2. Native Environment (Android & iOS)
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || supabaseAnonKey;

    // A. For videos or files without base64: Use streaming FileSystem.uploadAsync
    // This streams directly from device disk into the network without JS memory spikes (no OOM).
    if (isVideo || !base64) {
      const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${finalFileName}`;
      
      const res = await FileSystem.uploadAsync(uploadUrl, uri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': supabaseAnonKey,
          'Content-Type': mimeType,
          'x-upsert': 'true',
        },
      });

      if (res.status >= 200 && res.status < 300) {
        const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${finalFileName}`;
        return { success: true, publicUrl };
      }

      // Try fallback to 'avatars' bucket if primary bucket fails
      const fallbackUrl = `${supabaseUrl}/storage/v1/object/avatars/${finalFileName}`;
      const resFallback = await FileSystem.uploadAsync(fallbackUrl, uri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': supabaseAnonKey,
          'Content-Type': mimeType,
          'x-upsert': 'true',
        },
      });

      if (resFallback.status >= 200 && resFallback.status < 300) {
        const publicUrl = `${supabaseUrl}/storage/v1/object/public/avatars/${finalFileName}`;
        return { success: true, publicUrl };
      }

      throw new Error(`Upload failed with status ${res.status}: ${res.body}`);
    }

    // B. For images with base64: decode and upload via Supabase storage
    const arrayBuffer = decode(base64);
    const { error: uploadErr } = await supabase.storage
      .from(bucket)
      .upload(finalFileName, arrayBuffer, { contentType: mimeType, upsert: true });

    if (uploadErr) {
      const { error: fallbackErr } = await supabase.storage
        .from('avatars')
        .upload(finalFileName, arrayBuffer, { contentType: mimeType, upsert: true });
      if (fallbackErr) throw fallbackErr;
      const { data } = supabase.storage.from('avatars').getPublicUrl(finalFileName);
      return { success: true, publicUrl: data.publicUrl };
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(finalFileName);
    return { success: true, publicUrl: data.publicUrl };

  } catch (err: any) {
    console.error('Safe media upload error:', err);
    return { success: false, publicUrl: '', error: err.message || 'Media upload failed' };
  }
}
