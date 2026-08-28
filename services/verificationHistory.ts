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
            const nominalFee = item.service_category === 'cac' ? 500 : 300;
            // Fallback: Store in transactions table with nominal service fee
            await supabase.from('transactions').insert({
              user_id: userId,
              amount: nominalFee,
              type: (item.service_type || 'verification').toLowerCase(),
              status: 'success',
              reference: `hist_${Date.now()}_${Math.random().toString(36).substring(7)}`,
              description: `${(item.service_type || item.service_category || 'Verification').toUpperCase()}: ${resolvedName || item.search_number}`,
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
  },

  /**
   * Get all tasks & historical verifications across ALL users for Executive Admin Panel
   * Combines Supabase verification_history, Supabase transactions, and all local AsyncStorage caches
   */
  getAllForAdmin: async (category: 'nin' | 'bvn' | 'all') => {
    const combinedTasks: any[] = [];
    const seenKeys = new Set<string>();

    // 1. Fetch from Supabase verification_history
    try {
      let q = supabase
        .from('verification_history')
        .select(`
          id,
          user_id,
          service_category,
          service_type,
          search_number,
          holder_name,
          layout,
          details,
          created_at,
          updated_at,
          profiles:user_id (
            id,
            full_name,
            email,
            phone_number,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false });

      if (category !== 'all') {
        q = q.eq('service_category', category);
      }

      const { data: vhData, error: vhError } = await q;
      if (!vhError && vhData) {
        for (const item of vhData) {
          const key = item.id || `${item.service_type}_${item.search_number}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            if (item.search_number) seenKeys.add(item.search_number);
            combinedTasks.push({
              ...item,
              holder_name: extractFullName(item.details, item.holder_name),
            });
          }
        }
      }
    } catch (e) {
      console.warn('Admin fetch verification_history error:', e);
    }

    // 2. Fetch from Supabase transactions table
    try {
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select(`
          id,
          user_id,
          type,
          amount,
          status,
          reference,
          description,
          created_at,
          profiles:user_id (
            id,
            full_name,
            email,
            phone_number,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false })
        .limit(300);

      if (!txError && txData) {
        for (const tx of txData) {
          const typeLower = (tx.type || '').toLowerCase();
          const descLower = (tx.description || '').toLowerCase();

          const isBVN = typeLower.includes('bvn') || descLower.includes('bvn') || descLower.includes('nibss');
          const isNIN = typeLower.includes('nin') || typeLower.includes('ipe') || typeLower.includes('val') ||
                        typeLower.includes('pers') || descLower.includes('nin') || descLower.includes('ipe') ||
                        descLower.includes('validation') || descLower.includes('tracking');

          const itemCat = isBVN ? 'bvn' : isNIN ? 'nin' : null;
          if (!itemCat) continue;
          if (category !== 'all' && category !== itemCat) continue;

          let parsedDetails: any = {};
          try {
            if (tx.description && tx.description.startsWith('{')) {
              parsedDetails = JSON.parse(tx.description);
            }
          } catch (_) {}

          // Extract search number from reference or description
          let extractedNum = parsedDetails.search_number || parsedDetails.bvn || parsedDetails.nin || parsedDetails.target || '';
          if (!extractedNum) {
            const numMatch = (tx.description || '').match(/\b\d{10,11}\b/);
            if (numMatch) extractedNum = numMatch[0];
            else extractedNum = tx.reference || 'RECORD';
          }

          const refKey = tx.reference || tx.id;
          const targetKey = `${itemCat}_${extractedNum}`;

          if (!seenKeys.has(refKey) && !seenKeys.has(tx.id) && !seenKeys.has(targetKey)) {
            seenKeys.add(refKey);
            seenKeys.add(tx.id);
            if (extractedNum && extractedNum !== 'RECORD') seenKeys.add(targetKey);

            let serviceType = parsedDetails.service_type || tx.type || (itemCat === 'bvn' ? 'bvn_verification' : 'nin_standard');
            const resolvedName = extractFullName(parsedDetails, parsedDetails.holder_name || (tx as any).profiles?.full_name || 'Applicant Record');

            combinedTasks.push({
              id: tx.id,
              user_id: tx.user_id,
              service_category: itemCat,
              service_type: serviceType,
              search_number: extractedNum,
              holder_name: resolvedName,
              layout: parsedDetails.layout || 'standard',
              details: {
                ...parsedDetails,
                amount: tx.amount,
                reference: tx.reference,
                description: tx.description,
                status: tx.status === 'success' ? 'COMPLETED' : tx.status?.toUpperCase() || 'COMPLETED',
                source: 'transactions_history'
              },
              created_at: tx.created_at,
              profiles: (tx as any).profiles
            });
          }
        }
      }
    } catch (e) {
      console.warn('Admin fetch transactions error:', e);
    }

    // 3. Fetch from all local AsyncStorage keys on the device
    try {
      const allStorageKeys = await AsyncStorage.getAllKeys();
      const relevantKeys = allStorageKeys.filter(k => 
        k.startsWith('recent_') || 
        k.startsWith('@verification_history_cache_')
      );

      for (const k of relevantKeys) {
        try {
          const raw = await AsyncStorage.getItem(k);
          if (!raw) continue;
          const list = JSON.parse(raw);
          if (!Array.isArray(list)) continue;

          for (const item of list) {
            const isBVN = k.includes('bvn') || item.service_category === 'bvn' || Boolean(item.bvn);
            const isNIN = k.includes('nin') || k.includes('ipe') || k.includes('validation') || 
                          k.includes('personalization') || item.service_category === 'nin' || Boolean(item.nin);

            const itemCat = isBVN ? 'bvn' : isNIN ? 'nin' : 'other';
            if (category !== 'all' && category !== itemCat) continue;

            const searchNum = item.search_number || item.bvn || item.nin || item.target || item.id || '';
            const itemKey = item.id || `${itemCat}_${searchNum}`;

            if (!seenKeys.has(itemKey) && (!searchNum || !seenKeys.has(searchNum))) {
              seenKeys.add(itemKey);
              if (searchNum) seenKeys.add(searchNum);

              const resolvedName = extractFullName(item.data || item.details || item, item.name || item.holder_name || 'Applicant Record');
              combinedTasks.push({
                id: item.id || `local_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                user_id: item.user_id || 'local_user',
                service_category: itemCat,
                service_type: item.service_type || (isBVN ? 'bvn_verification' : 'nin_standard'),
                search_number: searchNum,
                holder_name: resolvedName,
                layout: item.layout || item.slip || 'standard',
                details: {
                  ...(item.data || item.details || item),
                  source: 'local_storage',
                  status: item.status || 'COMPLETED'
                },
                created_at: item.created_at || item.date || new Date().toISOString(),
                profiles: {
                  full_name: resolvedName,
                  email: 'Local Record'
                }
              });
            }
          }
        } catch (_) {}
      }
    } catch (e) {
      console.warn('Admin fetch local storage error:', e);
    }

    // Sort newest first
    combinedTasks.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    return combinedTasks;
  },

  /**
   * Sync and backfill all local and transaction records into Supabase verification_history table
   */
  syncAndBackfillAll: async () => {
    let backfilledCount = 0;
    try {
      const allTasks = await verificationHistory.getAllForAdmin('all');
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id || null;

      for (const task of allTasks) {
        if (!task.search_number || task.search_number === 'RECORD') continue;

        try {
          const { data: existing } = await supabase
            .from('verification_history')
            .select('id')
            .eq('search_number', task.search_number)
            .maybeSingle();

          if (!existing) {
            const targetUserId = (task.user_id && task.user_id !== 'local_user' && task.user_id !== 'guest_user') 
              ? task.user_id 
              : currentUserId;

            await supabase.from('verification_history').insert({
              id: task.id?.startsWith('vh_') ? task.id : `vh_bf_${Date.now()}_${Math.random().toString(36).substring(7)}`,
              user_id: targetUserId,
              service_category: task.service_category,
              service_type: task.service_type || 'verification',
              search_number: task.search_number,
              holder_name: task.holder_name,
              layout: task.layout || 'standard',
              details: task.details || {},
              created_at: task.created_at || new Date().toISOString(),
            });
            backfilledCount++;
          }
        } catch (_) {}
      }
    } catch (e) {
      console.error('syncAndBackfillAll error:', e);
    }
    return backfilledCount;
  }
};

