import { supabase } from './supabase';

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
  const d = details?.data || details || {};
  const firstname = d.firstname || d.first_name || '';
  const middlename = d.middlename || d.middle_name || '';
  const surname = d.surname || d.last_name || '';
  
  const constructed = [firstname, middlename, surname].filter(Boolean).join(' ').trim();
  if (constructed.length > 0) {
    return constructed.toUpperCase();
  }

  if (fallbackName && !['NIN Holder', 'Unknown Name', 'RECORD', 'N/A'].includes(fallbackName)) {
    return fallbackName.toUpperCase();
  }

  return 'NIN Holder';
};

export const verificationHistory = {
  /**
   * Save a verification item permanently to Supabase Database
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
      if (!authData?.user) return null;
      const userId = authData.user.id;

      const resolvedName = extractFullName(item.details, item.holder_name);

      const payload = {
        user_id: userId,
        service_category: item.service_category,
        service_type: item.service_type,
        search_number: item.search_number,
        holder_name: resolvedName,
        layout: item.layout || 'standard',
        details: item.details,
        created_at: new Date().toISOString(),
      };

      // Try inserting into verification_history table
      const { data, error } = await supabase
        .from('verification_history')
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.warn('verification_history table insert warning:', error.message);
        // Fallback: Store in transactions table metadata if table missing
        try {
          await supabase.from('transactions').insert({
            user_id: userId,
            amount: 0,
            type: 'history_record',
            status: 'success',
            reference: `hist_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            description: JSON.stringify(payload),
          });
        } catch (_) {}
      }

      return data || payload;
    } catch (e) {
      console.error('Failed to save verification to database:', e);
      return null;
    }
  },

  /**
   * Get all verification history for the logged-in user from Database
   */
  getAll: async (category?: 'nin' | 'bvn' | 'ipe' | 'validation' | 'personalization') => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return [];
      const userId = authData.user.id;

      let query = supabase
        .from('verification_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (category) {
        query = query.eq('service_category', category);
      }

      const { data, error } = await query;
      let results = (!error && data && data.length > 0) ? data : [];

      // Fallback: query transactions table for history_record if empty
      if (results.length === 0) {
        const { data: txData } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', userId)
          .eq('type', 'history_record')
          .order('created_at', { ascending: false });

        if (txData && txData.length > 0) {
          results = txData.map(tx => {
            try {
              const parsed = JSON.parse(tx.description);
              if (category && parsed.service_category !== category) return null;
              return { id: tx.id, ...parsed };
            } catch (_) {
              return null;
            }
          }).filter(Boolean);
        }
      }

      return results.map((item: any) => ({
        ...item,
        holder_name: extractFullName(item.details, item.holder_name)
      }));
    } catch (e) {
      console.error('Failed to fetch verification history from database:', e);
      return [];
    }
  },

  /**
   * Delete a verification item permanently from Database
   */
  delete: async (id: string) => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;
      
      try { await supabase.from('verification_history').delete().eq('id', id); } catch (_) {}
      try { await supabase.from('transactions').delete().eq('id', id); } catch (_) {}
    } catch (e) {
      console.error('Failed to delete verification history item from database:', e);
    }
  }
};
