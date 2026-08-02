/**
 * Bilalsadasub VTU & Telecom Integration Helper
 * Base URL: https://bilalsadasub.com
 * Supports: Airtime, Data, Plans Discovery
 */

import { supabase } from './supabase';

export interface BilalsadasubDataPlan {
  plan_id: string;
  network: string;
  plan_name: string;
  plan_type: string;
  plan_day: string;
  amount: number;
}

export const BilalsadasubProvider = {
  /**
   * Fetch Bilalsadasub Data Plans for a specific network (MTN, AIRTEL, GLO, T2)
   */
  getPlans: async (network: string = 'MTN'): Promise<BilalsadasubDataPlan[]> => {
    try {
      const netName = network.toUpperCase();
      const res = await fetch(`https://bilalsadasub.com/api/v1/plans/data?network=${netName}`);
      const data = await res.json();
      if (data && data.status === 'success' && Array.isArray(data.data)) {
        return data.data;
      }
      return [];
    } catch (e) {
      console.error('[Bilalsadasub] Error fetching data plans:', e);
      return [];
    }
  },

  /**
   * Purchase Airtime or Data via bills-payment Edge Function
   */
  purchase: async (params: { type: 'airtime' | 'data'; network: string; phone: string; amount?: number; planId?: string }) => {
    try {
      const { data, error } = await supabase.functions.invoke('bills-payment', {
        body: {
          type: params.type,
          network: params.network,
          phone: params.phone,
          amount: params.amount,
          planId: params.planId,
          vendor: 'bilalsadasub',
        },
      });

      if (error) {
        return { success: false, message: error.message || 'Failed to process transaction' };
      }

      if (data && data.success) {
        return {
          success: true,
          reference: data.requestId,
          message: data.data?.message || 'Transaction Successful',
        };
      }

      return {
        success: false,
        message: data?.error || 'Transaction Failed',
      };
    } catch (e: any) {
      return { success: false, message: e.message || 'Network error occurred' };
    }
  },
};
