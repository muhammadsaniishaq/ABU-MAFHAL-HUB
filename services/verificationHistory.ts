import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface VerificationHistoryItem {
  id: string;
  user_id: string;
  service_category: 'nin' | 'bvn' | 'cac' | 'tin' | 'other';
  service_type: string;
  search_number: string;
  holder_name: string;
  layout?: string;
  details: any;
  created_at: string;
}

export const extractFullName = (details: any, fallbackName?: string): string => {
  const d = details?.data?.data || details?.data?.user_details?.data || details?.data?.user_details || details?.data || details || {};
  const firstname = d.firstName || d.firstname || d.first_name || '';
  const middlename = d.middleName || d.middlename || d.middle_name || '';
  const surname = d.lastName || d.surname || d.last_name || '';
  
  const constructed = [firstname, middlename, surname].filter(Boolean).join(' ').trim();
  if (constructed.length > 0) {
    return constructed.toUpperCase();
  }

  if (d.fullName || d.name || d.nameOnCard) {
    return String(d.fullName || d.name || d.nameOnCard).toUpperCase();
  }

  if (fallbackName && !['NIN Holder', 'BVN Holder', 'Unknown Name', 'RECORD', 'N/A', 'BVN / NIN Holder'].includes(fallbackName)) {
    return fallbackName.toUpperCase();
  }

  return 'BVN / NIN Holder';
};

export const verificationHistory = {
  /**
   * Save a verification item permanently to Supabase Database & AsyncStorage Cache
   */
  save: async (item: {
    service_category: 'nin' | 'bvn' | 'cac' | 'tin' | 'other';
    service_type: string;
    search_number: string;
    holder_name: string;
    layout?: string;
    details: any;
  }) => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id || 'guest_user';
      const resolvedName = extractFullName(item.details, item.holder_name);

      const payload: VerificationHistoryItem = {
        id: `vh_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        user_id: userId,
        service_category: item.service_category,
        service_type: item.service_type,
        search_number: item.search_number,
        holder_name: resolvedName,
        layout: item.layout || 'standard',
        details: item.details,
        created_at: new Date().toISOString(),
      };

      // 1. Save to local AsyncStorage cache immediately (never lost)
      try {
        const cacheKey = `@verification_history_cache_${userId}`;
        const existingCache = await AsyncStorage.getItem(cacheKey);
        const list: VerificationHistoryItem[] = existingCache ? JSON.parse(existingCache) : [];
        const updatedList = [payload, ...list.filter(x => x.id !== payload.id)].slice(0, 100);
        await AsyncStorage.setItem(cacheKey, JSON.stringify(updatedList));

        // Also save to category specific cache (e.g. recent_bvn_verifications)
        if (item.service_category === 'bvn') {
          const bvnKey = 'recent_bvn_verifications';
          const bvnCache = await AsyncStorage.getItem(bvnKey);
          const bvnList = bvnCache ? JSON.parse(bvnCache) : [];
          const newBvnList = [
            {
              id: payload.id,
              bvn: item.search_number,
              name: resolvedName,
              service_type: item.service_type,
              date: new Date().toISOString(),
              data: item.details,
            },
            ...bvnList.filter((x: any) => x.id !== payload.id && x.bvn !== item.search_number)
          ].slice(0, 50);
          await AsyncStorage.setItem(bvnKey, JSON.stringify(newBvnList));
        }
      } catch (err) {
        console.warn('AsyncStorage history save warning:', err);
      }

      // 2. Save to Supabase Database
      if (userId !== 'guest_user') {
        try {
          const { data, error } = await supabase
            .from('verification_history')
            .insert({
              user_id: userId,
              service_category: item.service_category,
              service_type: item.service_type,
              search_number: item.search_number,
              holder_name: resolvedName,
              layout: item.layout || 'standard',
              details: item.details,
              created_at: payload.created_at,
            })
            .select()
            .single();

          if (!error && data) {
            return data;
          }

          if (error) {
            console.warn('verification_history table insert fallback:', error.message);
            // Fallback: Store in transactions table metadata
            await supabase.from('transactions').insert({
              user_id: userId,
              amount: 0,
              type: 'history_record',
              status: 'success',
              reference: `hist_${Date.now()}_${Math.random().toString(36).substring(7)}`,
              description: JSON.stringify(payload),
            });
          }
        } catch (dbErr) {
          console.warn('Database history insert error:', dbErr);
        }
      }

      return payload;
    } catch (e) {
      console.error('Failed to save verification history:', e);
      return null;
    }
  },

  /**
   * Get all verification history for the logged-in user from Database + Local Cache
   */
  getAll: async (category?: 'nin' | 'bvn' | 'ipe' | 'validation' | 'personalization') => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id || 'guest_user';

      let results: any[] = [];
      const seenIds = new Set<string>();

      // 1. Fetch from Supabase Database
      if (userId !== 'guest_user') {
        try {
          let query = supabase
            .from('verification_history')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

          if (category) {
            query = query.eq('service_category', category);
          }

          const { data, error } = await query;
          if (!error && data && data.length > 0) {
            for (const row of data) {
              const key = row.id || `${row.service_type}_${row.search_number}_${row.created_at}`;
              if (!seenIds.has(key)) {
                seenIds.add(key);
                results.push(row);
              }
            }
          }

          // Fallback: Check transactions table
          if (results.length === 0) {
            const { data: txData } = await supabase
              .from('transactions')
              .select('*')
              .eq('user_id', userId)
              .eq('type', 'history_record')
              .order('created_at', { ascending: false });

            if (txData && txData.length > 0) {
              for (const tx of txData) {
                try {
                  const parsed = JSON.parse(tx.description);
                  if (!category || parsed.service_category === category) {
                    const key = tx.id || `${parsed.service_type}_${parsed.search_number}`;
                    if (!seenIds.has(key)) {
                      seenIds.add(key);
                      results.push({ id: tx.id, ...parsed });
                    }
                  }
                } catch (_) {}
              }
            }
          }
        } catch (dbErr) {
          console.warn('Supabase getAll history warning:', dbErr);
        }
      }

      // 2. Fetch from Local Storage Cache & Merge
      try {
        const cacheKey = `@verification_history_cache_${userId}`;
        const cachedStr = await AsyncStorage.getItem(cacheKey);
        if (cachedStr) {
          const cachedList: VerificationHistoryItem[] = JSON.parse(cachedStr);
          for (const item of cachedList) {
            if (!category || item.service_category === category) {
              const key = item.id || `${item.service_type}_${item.search_number}_${item.created_at}`;
              if (!seenIds.has(key)) {
                seenIds.add(key);
                results.push(item);
              }
            }
          }
        }

        if (category === 'bvn') {
          const bvnKey = 'recent_bvn_verifications';
          const bvnCache = await AsyncStorage.getItem(bvnKey);
          if (bvnCache) {
            const bvnList = JSON.parse(bvnCache);
            for (const item of bvnList) {
              const key = item.id || item.bvn;
              if (!seenIds.has(key)) {
                seenIds.add(key);
                results.push({
                  id: item.id || `local_${item.bvn}`,
                  user_id: userId,
                  service_category: 'bvn',
                  service_type: item.service_type || 'bvn_verification',
                  search_number: item.bvn,
                  holder_name: item.name,
                  details: item.data,
                  created_at: item.date || new Date().toISOString(),
                });
              }
            }
          }
        }
      } catch (cacheErr) {
        console.warn('AsyncStorage getAll history warning:', cacheErr);
      }

      // Sort with newest first
      results.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

      return results.map((item: any) => ({
        ...item,
        holder_name: extractFullName(item.details, item.holder_name)
      }));
    } catch (e) {
      console.error('Failed to fetch verification history:', e);
      return [];
    }
  },

  /**
   * Delete a verification item permanently from Database & Local Cache
   */
  delete: async (id: string) => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id || 'guest_user';
      
      // Delete from Database
      if (userId !== 'guest_user') {
        try { await supabase.from('verification_history').delete().eq('id', id); } catch (_) {}
        try { await supabase.from('transactions').delete().eq('id', id); } catch (_) {}
      }

      // Delete from Local Cache
      try {
        const cacheKey = `@verification_history_cache_${userId}`;
        const cachedStr = await AsyncStorage.getItem(cacheKey);
        if (cachedStr) {
          const cachedList: VerificationHistoryItem[] = JSON.parse(cachedStr);
          const updated = cachedList.filter(x => x.id !== id);
          await AsyncStorage.setItem(cacheKey, JSON.stringify(updated));
        }

        const bvnKey = 'recent_bvn_verifications';
        const bvnCache = await AsyncStorage.getItem(bvnKey);
        if (bvnCache) {
          const bvnList = JSON.parse(bvnCache);
          const updatedBvn = bvnList.filter((x: any) => x.id !== id);
          await AsyncStorage.setItem(bvnKey, JSON.stringify(updatedBvn));
        }
      } catch (_) {}
    } catch (e) {
      console.error('Failed to delete verification history item:', e);
    }
  }
};
